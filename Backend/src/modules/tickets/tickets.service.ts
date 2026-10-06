import crypto from 'crypto'
import prisma from '../../config/db'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

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
