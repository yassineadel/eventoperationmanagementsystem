import { ApiError } from '../../lib/api'
import { getCart, holdSeats, holdStanding, releaseHold, type Hold } from '../../lib/bookingApi'
import type { Selection } from './bookingModel'

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
 * The seats this user holds right now for the event, as section-row-number labels.
 * Not signed in (or any other problem): none, so every held seat simply shows as held.
 */
export async function heldSeatLabels(eventId: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const cart = await getCart(eventId, signal)
    return cart.lines.flatMap((line) => line.seat ? [line.seat] : [])
  } catch {
    return []
  }
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
