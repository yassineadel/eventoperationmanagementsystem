import { cancelOrder, checkout, getCart, getOrder, simulatePayment, type CheckoutResult, type Order } from '../../lib/bookingApi'
import type { Selection } from './bookingModel'
import { getBookingCatalogue, seatLabel } from './catalogue'

export type PaymentChoice = 'success' | 'declined' | 'timeout'

// The seats held on the server are not exactly the seats the user chose (e.g. one hold ran out)
export class SeatMismatchError extends Error {}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Turns the held tickets into an order on the server (steps 1 to 3 below).
 * Stripe pays from the returned clientSecret; the simulator is told the outcome by payOnServer.
 */
export async function createServerOrder(
  eventId: string,
  items: Selection[],
  names: Record<string, string>,
  idempotencyKey: string,
): Promise<CheckoutResult> {
  // 1. The server's holds for this event, with their ids
  const cart = await getCart(eventId)

  // 2. The server wants one name per ticket, per hold.
  //    Seats: each seat is its own hold (quantity 1), and the cart names it "section-row-number".
  //    The name must go to the hold of THAT seat, so match each line to the chosen seat with the same label.
  const catalogue = getBookingCatalogue(eventId)
  const itemBySeat = new Map<string, Selection>()
  for (const item of items) {
    const seat = item.seatId ? catalogue?.seats.find((seat) => seat.id === item.seatId) : undefined
    if (seat) itemBySeat.set(seatLabel(seat), item)
  }
  //    Every chosen seat must be held, and every held seat must be chosen, or a ticket could be lost or get no name
  const seatLines = cart.lines.filter((line) => line.seat)
  if (seatLines.length !== itemBySeat.size || seatLines.some((line) => !itemBySeat.has(line.seat!))) throw new SeatMismatchError()

  //    Standing tickets have no seat: collect the names of the chosen tickets in each category, in order...
  const namesByCategory = new Map<string, string[]>()
  for (const item of items) {
    if (item.seatId) continue
    const list = namesByCategory.get(item.categoryId) ?? []
    list.push((names[item.key] ?? '').trim())
    namesByCategory.set(item.categoryId, list)
  }
  //    ...then give each hold as many names as it has tickets
  const attendees = cart.lines.map((line) => ({
    holdId: line.holdId,
    names: line.seat
      ? [(names[itemBySeat.get(line.seat)!.key] ?? '').trim()]
      : (namesByCategory.get(line.ticketCategoryId) ?? []).splice(0, line.quantity),
  }))

  // 3. Create the order (the same idempotencyKey never creates a second order)
  return checkout({ eventId, idempotencyKey, policyAccepted: true, attendees })
}

// Ask for the order until it is no longer PENDING. The server checks with Stripe each time, so a slow webhook doesn't matter.
export async function waitForOrder(orderId: string, attempts = 10): Promise<Order> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const latest = await getOrder(orderId)
    if (latest.status !== 'PENDING') return latest
    await wait(1500)
  }
  return getOrder(orderId)
}

/**
 * Buys the held tickets on the server with the payment simulator, and waits for the result.
 * Returns the order, whose status is PAID, FAILED or CANCELLED.
 */
export async function payOnServer(
  eventId: string,
  items: Selection[],
  names: Record<string, string>,
  idempotencyKey: string,
  choice: PaymentChoice,
): Promise<Order> {
  const { order, payment } = await createServerOrder(eventId, items, names, idempotencyKey)

  // An idempotent retry can return the saved result with no new payment session.
  if (['PAID', 'FAILED', 'CANCELLED'].includes(order.status)) return order

  // 4. Pay. "Timeout" means the buyer never finishes, so we cancel the order straight away.
  if (choice === 'timeout') {
    await cancelOrder(order.id)
    return { ...order, status: 'CANCELLED' }
  }
  if (payment) await simulatePayment(payment.providerTxId, choice === 'declined' ? 'decline' : 'success')

  // 5. Wait for the result
  return waitForOrder(order.id)
}
