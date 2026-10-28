// Loads a real event's booking data from the backend. Used by the ticket selection page,
// and by the cart and checkout after a page refresh (LiveBookingRestore).
import { getAvailability, getVenueLayout, parseSeatedLayout, type Hold } from '../../lib/bookingApi'
import type { CatalogEvent } from '../../lib/eventsModel'
import type { BookingAction, BookingError } from './bookingModel'
import { registerLiveCatalogue, registerLiveSeatedCatalogue } from './catalogue'
import { myHolds, ownQuantities, ownSeatIds, selectionFromHolds } from './liveHolds'

/**
 * Loads the live availability and this user's holds (and the seat layout for seated venues),
 * then registers the event's catalogue so the booking pages can use it.
 * Returns the user's holds, so the caller can rebuild the selection from them.
 */
export async function loadLiveBooking({ event, details }: CatalogEvent, signal?: AbortSignal): Promise<Hold[]> {
  const feePercents = Object.fromEntries(details.ticketCategories?.map((c) => [c.id, c.feePercent ?? 0]) ?? [])
  const [availability, holds] = await Promise.all([getAvailability(event.id, signal), myHolds(event.id, signal)])

  if (details.venueType === 'SEATED') {
    // Without the venue we can't load its seats
    if (!details.venueSlug) throw new Error('Missing venue')
    const layout = parseSeatedLayout(await getVenueLayout(details.venueSlug, signal))
    registerLiveSeatedCatalogue(event, availability, layout, feePercents, details.policies, ownSeatIds(holds))
  } else {
    registerLiveCatalogue(event, availability, feePercents, details.policies, ownQuantities(holds))
  }
  return holds
}

/**
 * Puts the server's holds back into the booking (after a page refresh), using the normal booking actions:
 * start clean for this event, choose the held tickets again, then follow the server's deadline.
 * With no holds nothing changes, so the page shows its usual "empty" or "expired" state.
 * The catalogue must be registered first (loadLiveBooking). Returns true when tickets were restored.
 */
export function restoreSelection(act: (action: BookingAction) => BookingError | undefined, eventId: string, holds: Hold[]) {
  const { items, expiresAt } = selectionFromHolds(holds)
  if (!items.length || expiresAt === null) return false
  act({ type: 'reset', eventId })
  if (act({ type: 'select', eventId, items })) return false // the tickets can't be used anymore (e.g. the event started)
  act({ type: 'held', expiresAt })
  return true
}
