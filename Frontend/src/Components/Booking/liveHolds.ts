import { getCart, holdStanding, releaseHold, type Hold } from '../../lib/bookingApi'
import type { Selection } from './bookingModel'

/**
 * Makes the server's holds for this event match the chosen tickets (standing venues).
 * Returns the earliest hold deadline in milliseconds, or null when nothing is held anymore.
 */
export async function syncHolds(eventId: string, items: Selection[]): Promise<number | null> {
  // Give back everything held earlier for this event
  const previous = await getCart(eventId)
  await Promise.all(previous.lines.map((line) => releaseHold(line.holdId)))

  // Count the chosen tickets per category, then hold each category once
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)

  const holds: Hold[] = []
  for (const [categoryId, quantity] of counts) {
    const result = await holdStanding(eventId, categoryId, quantity)
    holds.push(...result.holds)
  }

  return holds.length ? Math.min(...holds.map((hold) => Date.parse(hold.expiresAt))) : null
}