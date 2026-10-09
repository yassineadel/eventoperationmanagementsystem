import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { guardTx } from '../../utils/guardTx'
import { sendTicketEmail } from './ticket-mail'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export class TicketError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const MAX_TRANSFERS = 3 // FR-MTK-12, BR-07

/**
 * A QR token is 32 random bytes: it carries no meaning and cannot be guessed or derived from
 * another ticket's token (NFR-13). The gate looks the token up; the seat or category it
 * identifies (FR-TKT-17/21) comes from the ticket row, never from the token itself.
 */
export const newQrToken = () => crypto.randomBytes(32).toString('base64url')

/**
 * Issues one ticket per attendee for a paid order (FR-CHK-07, BR-02). Runs inside the
 * fulfilment transaction, after the order's holds have been converted to sold.
 */
export const issueTicketsForOrder = async (tx: Tx, orderId: string) => {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      userId: true,
      eventId: true,
      isSynthetic: true,
      items: { select: { id: true, ticketCategoryId: true } },
      holds: { select: { ticketCategoryId: true, seatId: true, quantity: true, attendeeNames: true } },
    },
  })
  const itemByCategory = new Map(order.items.map((i) => [i.ticketCategoryId, i.id]))

  const tickets = order.holds.flatMap((h) =>
    Array.from({ length: h.quantity }, (_, i) => ({
      orderItemId: itemByCategory.get(h.ticketCategoryId)!,
      eventId: order.eventId,
      ticketCategoryId: h.ticketCategoryId,
      seatId: h.seatId,
      attendeeName: h.attendeeNames[i],
      purchaserId: order.userId,
      holderId: order.userId,
      qrToken: newQrToken(),
      isSynthetic: order.isSynthetic,
    })),
  )

  // uidx_tickets_event_seat_live makes it impossible to issue two live tickets for one seat
  await tx.ticket.createMany({ data: tickets })
  return tickets.length
}

// ─── My Tickets ─────────────────────────────────────────────────────────────

/** What the holder, or a previous holder, sees as the ticket's state (FR-MTK-17) */
export type TicketView = 'VALID' | 'USED' | 'REFUNDED' | 'VOID' | 'TRANSFERRED_AWAY' | 'EXPIRED'

const eventEnd = (e: { startAt: Date; durationMinutes: number }) => new Date(e.startAt.getTime() + e.durationMinutes * 60_000)

const ticketInclude = {
  event: {
    select: {
      id: true, name: true, startAt: true, doorsOpenAt: true, durationMinutes: true, status: true,
      venue: { select: { name: true, address: true, city: true } },
    },
  },
  ticketCategory: { select: { name: true, categoryKey: true } },
  seat: { select: { section: true, row: true, number: true } },
  orderItem: { select: { order: { select: { reference: true } } } },
} as const

type TicketRow = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>

const viewOf = (t: TicketRow, userId: string): TicketView => {
  if (t.holderId !== userId) return 'TRANSFERRED_AWAY'
  if (t.status !== 'VALID') return t.status
  if (t.event.status === 'CANCELLED') return 'VOID'
  if (eventEnd(t.event) < new Date()) return 'EXPIRED'
  return 'VALID'
}

const present = (t: TicketRow, userId: string) => {
  const status = viewOf(t, userId)
  return {
    id: t.id,
    status,
    attendeeName: t.attendeeName,
    // The code is only shown to the current holder of a usable ticket (exactly one valid code, FR-MTK-13)
    qrToken: status === 'VALID' ? t.qrToken : null,
    orderReference: t.orderItem.order.reference,
    category: t.ticketCategory.name,
    seat: t.seat ? { section: t.seat.section, row: t.seat.row, number: t.seat.number } : null,
    event: {
      id: t.event.id,
      name: t.event.name,
      startAt: t.event.startAt,
      doorsOpenAt: t.event.doorsOpenAt,
      endsAt: eventEnd(t.event),
      venue: t.event.venue,
    },
    transferCount: t.transferCount,
    transfersLeft: Math.max(0, MAX_TRANSFERS - t.transferCount),
    usedAt: t.usedAt,
  }
}

const mine = (userId: string): Prisma.TicketWhereInput => ({
  OR: [{ holderId: userId }, { transfers: { some: { fromUserId: userId } } }],
})

/**
 * Every ticket the user holds, plus the ones they transferred away, split into upcoming and past (FR-MTK-01)
 */
export const getMyTickets = async (userId: string) => {
  const tickets = await prisma.ticket.findMany({
    where: mine(userId),
    include: ticketInclude,
    orderBy: { event: { startAt: 'asc' } },
  })
  const now = new Date()
  const all = tickets.map((t) => present(t, userId))
  return {
    upcoming: all.filter((t) => t.event.endsAt >= now),
    past: all.filter((t) => t.event.endsAt < now).reverse(),
  }
}

/**
 * One ticket, for the ticket screen with the QR code (FR-MTK-02)
 */
export const getMyTicket = async (userId: string, ticketId: string) => {
  const t = await prisma.ticket.findFirst({ where: { id: ticketId, ...mine(userId) }, include: ticketInclude })
  if (!t) throw new TicketError('Ticket not found', 404)
  return present(t, userId)
}

/**
 * Send the same ticket, same QR code, to the holder's email again. No new ticket is issued (FR-MTK-03).
 * Queued as a notification for the email worker. At most 3 per ticket per hour.
 */
export const resendTicket = async (userId: string, ticketId: string) => {
  const ticket = await getMyTicket(userId, ticketId)
  if (ticket.status !== 'VALID') throw new TicketError('Only valid tickets can be re-sent')

  const recent = await prisma.notification.count({
    where: { ticketId, type: 'TICKET_RESEND', createdAt: { gt: new Date(Date.now() - 3_600_000) } },
  })
  if (recent >= 3) throw new TicketError('This ticket was re-sent recently. Please check your inbox and spam folder.', 429)

  try {
    await sendTicketEmail(ticketId)
  } catch (e) {
    console.error(`Ticket email for ${ticketId} failed:`, e instanceof Error ? e.message : e)
    throw new TicketError('We could not send the email right now. Please try again in a few minutes.', 502)
  }
  await prisma.notification.create({
    data: { userId, ticketId, type: 'TICKET_RESEND', subject: `Your ticket for ${ticket.event.name}` },
  })
}

// ─── Transfers ──────────────────────────────────────────────────────────────

/**
 * Give a ticket to another registered, verified user (FR-MTK-10 to 16, BR-07, BR-08).
 * The ticket stays the same; only the holder changes, and the old QR code stops working.
 */
export const transferTicket = async (userId: string, ticketId: string, recipientEmail: string) => {
  const result = await moveTicket(userId, ticketId, recipientEmail)
  // the new holder gets the ticket with its new QR; a failed email must not undo the transfer
  sendTicketEmail(ticketId).catch((e) => console.error(`Ticket email for ${ticketId} failed:`, e.message))
  return result
}

const moveTicket = async (userId: string, ticketId: string, recipientEmail: string) => {
  const email = String(recipientEmail ?? '').trim().toLowerCase()
  const ticket = await getMyTicket(userId, ticketId)
  if (ticket.status !== 'VALID') throw new TicketError('Only valid tickets for upcoming events can be transferred')
  if (new Date(ticket.event.startAt) <= new Date()) throw new TicketError('This event has already started')
  if (ticket.transfersLeft === 0) throw new TicketError(`A ticket can be transferred at most ${MAX_TRANSFERS} times`)

  // Only to an existing account: a user row exists only once the email is verified (FR-AUT-03)
  const recipient = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, isBlocked: true } })
  if (!recipient || recipient.role !== 'USER') {
    throw new TicketError('No Hafletna account uses this email. Ask the person to register first, then try again.', 404)
  }
  if (recipient.id === userId) throw new TicketError('You already hold this ticket')
  if (recipient.isBlocked) throw new TicketError('This ticket cannot be transferred to that account')

  const openRefund = await prisma.refund.findFirst({ where: { ticketId, status: { in: ['SUBMITTED', 'APPROVED'] } } })
  if (openRefund) throw new TicketError('This ticket has a refund in progress and cannot be transferred')

  return prisma.$transaction(async (tx) => {
    await guardTx(tx)
    // Conditional: only moves if nothing changed since we looked (no double transfer, cap respected)
    const { count } = await tx.ticket.updateMany({
      where: { id: ticketId, holderId: userId, status: 'VALID', transferCount: { lt: MAX_TRANSFERS } },
      data: { holderId: recipient.id, transferCount: { increment: 1 }, qrToken: newQrToken() },
    })
    if (count !== 1) throw new TicketError('This ticket can no longer be transferred', 409)

    const { transferCount } = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { transferCount: true } })
    // (ticket, sequence) is unique, so the chain can never fork (FR-MTK-15)
    await tx.transfer.create({ data: { ticketId, fromUserId: userId, toUserId: recipient.id, sequence: transferCount } })

    // Both sides get an email (FR-MTK-16)
    await tx.notification.createMany({
      data: [
        { userId, ticketId, type: 'TRANSFER_SENT', subject: `You transferred your ticket for ${ticket.event.name}` },
        { userId: recipient.id, ticketId, type: 'TRANSFER_RECEIVED', subject: `You received a ticket for ${ticket.event.name}` },
      ],
    })
    return { transferCount, transfersLeft: MAX_TRANSFERS - transferCount }
  })
}

/**
 * Everyone who has held the ticket, in order — for administrators (FR-MTK-15)
 */
export const getTransferChain = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      purchaser: { select: { id: true, fullName: true, email: true } },
      holder: { select: { id: true, fullName: true, email: true } },
      transfers: {
        orderBy: { sequence: 'asc' },
        select: {
          sequence: true,
          createdAt: true,
          fromUser: { select: { id: true, email: true } },
          toUser: { select: { id: true, email: true } },
        },
      },
    },
  })
  if (!ticket) throw new TicketError('Ticket not found', 404)
  return ticket
}
