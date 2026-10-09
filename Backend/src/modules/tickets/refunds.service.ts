import prisma from '../../config/db'
import { getPaymentProvider, toMinorUnits } from '../payments/payments.service'
import { TicketError } from './tickets.service'
import { guardTx } from '../../utils/guardTx'

// User-requested refunds (FR-MTK-04 to FR-MTK-09, FR-ADM-16, BR-04 to BR-06, BR-09).
// The buyer paid the ticket price plus a category-dependent service fee. On a user refund the
// platform keeps the fee, so the amount returned is the ticket price as charged at purchase.

export const REFUND_CUTOFF_DAYS = 7 // FR-MTK-04
export const SETTLEMENT_NOTICE = 'Refunds are settled to your original payment method within two weeks of approval.' // FR-MTK-08, BR-06

const DAY = 86_400_000

const loadTicket = (ticketId: string) =>
  prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      status: true,
      holderId: true,
      purchaserId: true,
      transferCount: true,
      ticketCategoryId: true,
      event: { select: { name: true, startAt: true, status: true } },
      orderItem: {
        select: {
          unitPrice: true,
          serviceFeeAmount: true,
          order: { select: { payment: { select: { providerTxId: true, status: true } } } },
        },
      },
      refunds: { where: { status: { in: ['SUBMITTED', 'APPROVED', 'SETTLED'] } }, select: { status: true } },
    },
  })

/**
 * Whether the user may ask for a refund on this ticket, and exactly how much they would get (FR-MTK-08)
 */
export const getRefundQuote = async (userId: string, ticketId: string) => {
  const t = await loadTicket(ticketId)
  if (!t || t.holderId !== userId) throw new TicketError('Ticket not found', 404)

  const deadline = new Date(t.event.startAt.getTime() - REFUND_CUTOFF_DAYS * DAY)
  let reason: string | null = null
  if (t.status !== 'VALID') reason = 'Only valid tickets can be refunded'
  else if (t.event.status === 'CANCELLED') reason = 'This event was cancelled; you will be refunded in full automatically'
  else if (t.transferCount > 0 || t.purchaserId !== userId) reason = 'Transferred tickets cannot be refunded' // BR-09
  else if (new Date() > deadline) reason = `Refunds close ${REFUND_CUTOFF_DAYS} days before the event`
  else if (t.refunds.length > 0) reason = 'A refund has already been requested for this ticket'

  return {
    ticketId,
    eligible: reason === null,
    reason,
    pricePaid: t.orderItem.unitPrice.add(t.orderItem.serviceFeeAmount),
    serviceFeeRetained: t.orderItem.serviceFeeAmount,
    refundAmount: t.orderItem.unitPrice,
    currency: 'EGP',
    requestDeadline: deadline,
    settlement: SETTLEMENT_NOTICE,
  }
}

/**
 * Ask for a refund. It waits for an administrator; nothing is paid automatically (FR-MTK-05).
 */
export const requestRefund = async (userId: string, ticketId: string, reason?: string) => {
  return prisma.$transaction(async (tx) => {
    await guardTx(tx)
    // Lock the ticket so two parallel requests cannot both pass the "no refund yet" check
    await tx.$executeRaw`SELECT id FROM tickets WHERE id = ${ticketId}::uuid FOR UPDATE`
    const quote = await getRefundQuote(userId, ticketId)
    if (!quote.eligible) throw new TicketError(quote.reason!)

    return tx.refund.create({
      data: {
        ticketId,
        type: 'USER_REQUESTED',
        requestedById: userId,
        payeeId: userId, // the current holder (BR-13); never transferred, so also the buyer
        reason: reason?.slice(0, 1000),
        amount: quote.refundAmount,
        serviceFeeRetained: quote.serviceFeeRetained,
      },
      select: { id: true, status: true, amount: true, serviceFeeRetained: true, createdAt: true },
    })
  })
}

/**
 * The user's refund requests and where each one is (FR-MTK-09)
 */
export const getMyRefunds = (userId: string) =>
  prisma.refund.findMany({
    where: { payeeId: userId },
    select: {
      id: true, status: true, type: true, amount: true, serviceFeeRetained: true, rejectionReason: true,
      createdAt: true, reviewedAt: true, settledAt: true,
      ticket: { select: { id: true, attendeeName: true, event: { select: { name: true, startAt: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

// ─── Administrator side (FR-ADM-16) ─────────────────────────────────────────

/**
 * The approval queue, oldest first so requests close to the deadline are not missed (risk R9)
 */
export const listRefunds = (status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SETTLED') =>
  prisma.refund.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true, status: true, type: true, amount: true, serviceFeeRetained: true, reason: true, rejectionReason: true,
      createdAt: true, reviewedAt: true, settledAt: true,
      payee: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true } },
      ticket: {
        select: {
          id: true, attendeeName: true,
          event: { select: { id: true, name: true, startAt: true } },
          ticketCategory: { select: { name: true } },
          orderItem: { select: { order: { select: { reference: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

const audit = (adminId: string, action: string, refundId: string, details?: object) =>
  prisma.auditLog.create({ data: { actorUserId: adminId, action, entityType: 'Refund', entityId: refundId, details } })

/**
 * Approve: the ticket stops being valid at once (refused at the gate), its place goes back on sale
 * (FR-TKT-03), and the money is sent back through the payment provider.
 */
export const approveRefund = async (adminId: string, refundId: string) => {
  const refund = await prisma.$transaction(async (tx) => {
    await guardTx(tx)
    const { count } = await tx.refund.updateMany({
      where: { id: refundId, status: 'SUBMITTED' },
      data: { status: 'APPROVED', reviewedById: adminId, reviewedAt: new Date() },
    })
    if (count !== 1) throw new TicketError('Only submitted refund requests can be approved', 409)

    const r = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: { ticketId: true, payeeId: true, ticket: { select: { ticketCategoryId: true, event: { select: { name: true } } } } },
    })
    const voided = await tx.ticket.updateMany({ where: { id: r.ticketId, status: 'VALID' }, data: { status: 'REFUNDED' } })
    if (voided.count !== 1) throw new TicketError('This ticket is no longer valid (already used or refunded)', 409)

    await tx.$executeRaw`UPDATE ticket_categories SET sold_count = sold_count - 1 WHERE id = ${r.ticket.ticketCategoryId}::uuid`
    await tx.notification.create({
      data: { userId: r.payeeId, ticketId: r.ticketId, type: 'REFUND_APPROVED', subject: `Your refund for ${r.ticket.event.name} was approved` },
    })
    return r
  })
  await audit(adminId, 'REFUND_APPROVED', refundId)
  await settleRefund(adminId, refundId)
  return refund
}

/**
 * Send the money back. Safe to retry: the provider sees the same idempotency key every time.
 * If the provider is unreachable the refund stays APPROVED and can be retried.
 */
export const settleRefund = async (adminId: string, refundId: string) => {
  const r = await prisma.refund.findUniqueOrThrow({
    where: { id: refundId },
    select: {
      status: true,
      amount: true,
      ticket: { select: { orderItem: { select: { order: { select: { payment: { select: { providerTxId: true } } } } } } } },
    },
  })
  if (r.status === 'SETTLED') return 'SETTLED'
  if (r.status !== 'APPROVED') throw new TicketError('Only approved refunds can be settled', 409)

  const txId = r.ticket.orderItem.order.payment?.providerTxId
  if (!txId) throw new TicketError('No payment found for this ticket', 409)
  try {
    await getPaymentProvider().refund(txId, { amountMinor: toMinorUnits(r.amount), idempotencyKey: `refund-${refundId}` })
  } catch (e) {
    console.error(`Refund ${refundId} could not be settled yet:`, e)
    return 'APPROVED'
  }
  await prisma.refund.updateMany({ where: { id: refundId, status: 'APPROVED' }, data: { status: 'SETTLED', settledAt: new Date() } })
  await audit(adminId, 'REFUND_SETTLED', refundId, { amount: r.amount.toString() })
  return 'SETTLED'
}

export const rejectRefund = async (adminId: string, refundId: string, reason: string) => {
  if (!reason?.trim()) throw new TicketError('Please give a reason for rejecting')
  const { count } = await prisma.refund.updateMany({
    where: { id: refundId, status: 'SUBMITTED' },
    data: { status: 'REJECTED', reviewedById: adminId, reviewedAt: new Date(), rejectionReason: reason.trim().slice(0, 1000) },
  })
  if (count !== 1) throw new TicketError('Only submitted refund requests can be rejected', 409)

  const r = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, select: { payeeId: true, ticketId: true } })
  await prisma.notification.create({
    data: { userId: r.payeeId, ticketId: r.ticketId, type: 'REFUND_REJECTED', subject: 'Your refund request was not approved' },
  })
  await audit(adminId, 'REFUND_REJECTED', refundId, { reason })
}
