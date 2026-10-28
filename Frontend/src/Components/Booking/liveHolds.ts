import { ApiError } from '../../lib/api'
import { getCart, getMyHolds, holdSeats, holdStanding, releaseHold, type Hold } from '../../lib/bookingApi'
import { MAX_TICKETS, type Selection } from './bookingModel'

// One or more of the chosen seats was held or bought by someone else before we could hold it
export class SeatTakenError extends Error {}

/**
 * Makes the server's holds for this event match the chosen tickets.
 * Seated venues: the chosen seats, all or nothing. Standing venues: a quantity per category.
 * Returns the earliest hold deadline in milliseconds, or null when nothing is held anymore.
 */
export async function syncHolds(eventId: string, items: Selection[]): Promise<number | null> {
  // Give back everything held earlier for this event
  const previous = await getCart(eventId)
  await Promise.all(previous.lines.map((line) => releaseHold(line.holdId)))

  const holds: Hold[] = []

  // Seats: one call for all of them. The server holds every seat or none.
  const seatIds = items.flatMap((item) => item.seatId ? [item.seatId] : [])
  if (seatIds.length) {
    try {
      holds.push(...(await holdSeats(eventId, seatIds)).holds)
    } catch (error) {
      // 409 = a seat is already held by someone else or sold
      if (error instanceof ApiError && error.status === 409) throw new SeatTakenError(error.message)
      throw error
    }
  }

  // Standing tickets: count them per category, then hold each category once
  const counts = new Map<string, number>()
  for (const item of items) if (!item.seatId) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
  for (const [categoryId, quantity] of counts) {
    const result = await holdStanding(eventId, categoryId, quantity)
    holds.push(...result.holds)
  }

  return holds.length ? Math.min(...holds.map((hold) => Date.parse(hold.expiresAt))) : null
}

/**
 * This user's active holds for the event, straight from the server.
 * Not signed in (401), or an account that can't buy (403): no holds. Other problems are real errors.
 */
export async function myHolds(eventId: string, signal?: AbortSignal): Promise<Hold[]> {
  try {
    return await getMyHolds(eventId, signal)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return []
    throw error
  }
}

// The seats in these holds
export function ownSeatIds(holds: Hold[]): string[] {
  return holds.flatMap((hold) => hold.seatId ? [hold.seatId] : [])
}

// How many standing places these holds have in each category
export function ownQuantities(holds: Hold[]): Record<string, number> {
  const quantities: Record<string, number> = {}
  for (const hold of holds) if (!hold.seatId) quantities[hold.ticketCategoryId] = (quantities[hold.ticketCategoryId] ?? 0) + hold.quantity
  return quantities
}

/**
 * Rebuilds the user's selection from the server's holds (after a page refresh).
 * - A seat hold becomes one ticket for that seat.
 * - A standing hold of quantity 3 in category C becomes tickets "C-1", "C-2", "C-3" (the keys the standing page uses).
 * expiresAt: the earliest hold deadline in milliseconds, so the timer ends when the first hold ends.
 */
export function selectionFromHolds(holds: Hold[]): { items: Selection[]; expiresAt: number | null } {
  const items: Selection[] = []
  const countPerCategory = new Map<string, number>()
  for (const hold of holds) {
    if (hold.seatId) {
      items.push({ key: hold.seatId, seatId: hold.seatId, categoryId: hold.ticketCategoryId })
      continue
    }
    for (let i = 0; i < hold.quantity; i++) {
      const number = (countPerCategory.get(hold.ticketCategoryId) ?? 0) + 1
      countPerCategory.set(hold.ticketCategoryId, number)
      if (number <= MAX_TICKETS) items.push({ key: `${hold.ticketCategoryId}-${number}`, categoryId: hold.ticketCategoryId })
    }
  }
  const expiresAt = holds.length ? Math.min(...holds.map((hold) => Date.parse(hold.expiresAt))) : null
  return { items, expiresAt }
}

/**
 * Gives one seat back on the server (the user removed it in the cart). The other seats stay held.
 * label: the seat as the cart writes it, section-row-number.
 */
export async function releaseSeatHold(eventId: string, label: string) {
  const cart = await getCart(eventId)
  const line = cart.lines.find((line) => line.seat === label)
  if (!line) return // not held anymore (its time ran out), nothing to give back
  try {
    await releaseHold(line.holdId)
  } catch (error) {
    // 404: the hold ended between the two calls, which is what we wanted anyway
    if (!(error instanceof ApiError && error.status === 404)) throw error
  }
}
