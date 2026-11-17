/**
 * The signed-in user's own tickets, orders and refunds, for questions such as "where are my
 * tickets?" or "what happened to my refund?".
 *
 * The user id always comes from the login (req.user), never from the model, so the model can only
 * ever read the account of the person asking. It goes through the same services as the website's
 * My Tickets page, which already enforce ownership. QR codes are never given to the model.
 */
import { getMyTickets } from '../../tickets/tickets.service'
import { getMyRefunds, getRefundQuote } from '../../tickets/refunds.service'
import { getMyOrders } from '../../orders/orders.service'

const CAIRO = 'Africa/Cairo'
const when = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: CAIRO,
})
const egp = (n: unknown) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP`

const TICKET_STATUS: Record<string, string> = {
  VALID: 'valid (can be used for entry)',
  USED: 'already used at the gate',
  REFUNDED: 'refunded',
  VOID: 'void because the event was cancelled',
  TRANSFERRED_AWAY: 'transferred to someone else (no longer yours)',
  EXPIRED: 'the event has ended',
}

const ORDER_STATUS: Record<string, string> = {
  PENDING: 'waiting for payment',
  PAID: 'paid',
  FAILED: 'payment failed',
  CANCELLED: 'cancelled, or not paid in time',
}

const REFUND_STATUS: Record<string, string> = {
  SUBMITTED: 'waiting for an administrator to review it',
  APPROVED: 'approved; the money is on its way',
  REJECTED: 'declined',
  SETTLED: 'paid back',
}

/** The user's tickets: upcoming first, then up to 5 past ones */
export const myTickets = async (userId: string) => {
  const { upcoming, past } = await getMyTickets(userId)
  const present = (t: (typeof upcoming)[number]) => ({
    ticket_id: t.id,
    event_id: t.event.id,
    event: t.event.name,
    starts: `${when.format(t.event.startAt)} (doors ${when.format(t.event.doorsOpenAt).split(', ').pop()})`,
    venue: `${t.event.venue.name}, ${t.event.venue.city}`,
    status: TICKET_STATUS[t.status] ?? t.status,
    ticket_type: t.category,
    seat: t.seat ? `section ${t.seat.section}, row ${t.seat.row}, seat ${t.seat.number}` : 'standing / no seat number',
    attendee_name: t.attendeeName,
    order_reference: t.orderReference,
    transfers_left: t.status === 'VALID' ? t.transfersLeft : undefined,
    refund: t.refund
      ? `${REFUND_STATUS[t.refund.status] ?? t.refund.status}, ${egp(t.refund.amount)}${t.refund.message ? `; administrator's message: "${t.refund.message}"` : ''}`
      : undefined,
  })
  return {
    upcoming: upcoming.map(present),
    past: past.slice(0, 5).map(present),
    note: 'The QR code for entry is on the ticket in My Tickets and in the ticket email.',
  }
}

/** The user's 10 most recent orders */
export const myOrders = async (userId: string) => {
  const orders = await getMyOrders(userId)
  return {
    orders: orders.slice(0, 10).map((o) => ({
      reference: o.reference,
      event_id: o.event.id,
      event: o.event.name,
      status: ORDER_STATUS[o.status] ?? o.status,
      tickets: o.items.reduce((n, i) => n + i.quantity, 0),
      total: egp(o.total),
      placed: when.format(o.createdAt),
      paid: o.paidAt ? when.format(o.paidAt) : undefined,
      pay_before: o.status === 'PENDING' && o.expiresAt ? when.format(o.expiresAt) : undefined,
    })),
  }
}

/** The user's refunds, newest first */
export const myRefunds = async (userId: string) => {
  const refunds = await getMyRefunds(userId)
  return {
    refunds: refunds.slice(0, 10).map((r) => ({
      event: r.ticket.event.name,
      attendee_name: r.ticket.attendeeName,
      reason:
        r.type === 'EVENT_CANCELLED' ? 'event cancelled (full refund)' : r.type === 'USER_BLOCKED' ? 'account blocked by Hafletna' : 'requested by you',
      status: REFUND_STATUS[r.status] ?? r.status,
      amount: egp(r.amount),
      service_fee_kept: Number(r.serviceFeeRetained) > 0 ? egp(r.serviceFeeRetained) : undefined,
      requested: when.format(r.createdAt),
      decided: r.reviewedAt ? when.format(r.reviewedAt) : undefined,
      paid_back: r.settledAt ? when.format(r.settledAt) : undefined,
      administrator_message: r.rejectionReason ?? undefined,
    })),
  }
}

/** Whether one of the user's tickets can be refunded now, and exactly how much they would get back */
export const myRefundQuote = async (userId: string, ticketId: string) => {
  const q = await getRefundQuote(userId, ticketId)
  return {
    can_request_refund: q.eligible,
    why_not: q.reason ?? undefined,
    price_paid: egp(q.pricePaid),
    service_fee_kept: egp(q.serviceFeeRetained),
    would_get_back: egp(q.refundAmount),
    request_before: `${when.format(q.requestDeadline)} (Cairo time)`,
    settlement: q.settlement,
    how: 'Open the ticket in My Tickets and choose Request refund.',
  }
}
