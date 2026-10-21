import { categoryNames } from '../Components/Homepage/strings.ts'
import type { Category } from '../Components/Homepage/types'
import type { ListingFilters } from '../Components/Discovery/listing'
import { eventIdPattern, listingApiQuery, mapEventDetail, parseEventsPage, type CategoryCounts } from './eventsModel.ts'
import type { Event } from '../Components/Homepage/types.ts'

export type EventsGet = (path: string, init: { signal: AbortSignal }) => Promise<unknown>
export function createEventsClient(get: EventsGet, assetOrigin?: string) {
  const imageUrl = (image: string) => assetOrigin && image.startsWith('/') && !image.startsWith('/event-images/') ? new URL(image, assetOrigin).href : image
  return {
    async listing(filters: ListingFilters, signal: AbortSignal) {
      const result = parseEventsPage(await get(`/api/events?${listingApiQuery(filters)}`, { signal }))
      return { ...result, events: result.events.map((event) => ({ ...event, image: imageUrl(event.image) })) }
    },
    async detail(id: string, signal: AbortSignal) {
      const result = mapEventDetail(await get(`/api/events/${encodeURIComponent(id)}`, { signal }))
      if (result.event.id !== id.toLowerCase()) throw new Error('Event ID does not match')
      return { event: { ...result.event, image: imageUrl(result.event.image) }, details: { ...result.details, gallery: result.details.gallery.map(imageUrl) } }
    },
    // Until categoryCounts ships, each filtered total is counted by the backend.
    // Category selection, sorting and page are excluded from the facet query.
    async counts(filters: ListingFilters, signal: AbortSignal): Promise<CategoryCounts> {
      const pairs = await Promise.all((Object.keys(categoryNames) as Category[]).map(async (category) => {
        const page = parseEventsPage(await get(`/api/events?${listingApiQuery({ ...filters, categories: [category], page: 1, sort: 'soonest', savedOnly: false })}`, { signal }))
        return [category, page.total] as const
      }))
      return Object.fromEntries(pairs) as CategoryCounts
    },
  }
}
export type EventsClient = ReturnType<typeof createEventsClient>

export async function loadSavedEvents(client: EventsClient, ids: readonly string[], signal: AbortSignal) {
  const pending = [...new Set(ids.filter((id) => eventIdPattern.test(id)).map((id) => id.toLowerCase()))]
  const events: Event[] = [], missing: string[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (cursor < pending.length) {
      const id = pending[cursor++]
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      try { events.push((await client.detail(id, signal)).event) }
      catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) missing.push(id)
        else throw error
      }
    }
  }))
  return { events, missing }
}
