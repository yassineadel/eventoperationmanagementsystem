import type { EventView, Filters, LocalizedText, RecommendationPreferences } from '../Components/Homepage/types.ts'
import { parseListingFilters, type ListingFilters } from '../Components/Discovery/listing.ts'
import { cityNames } from '../Components/Homepage/strings.ts'
import { eventIdPattern, safeEventImage } from './eventsModel.ts'

export type PublicVenue = {
  id: string; name: LocalizedText; city: LocalizedText; searchCity: string;
  image: string; illustrativeImage: boolean;
}

export function homepageQuery(filters: Filters, view: EventView, preferences: RecommendationPreferences): { filters: ListingFilters; conflict: boolean } {
  const result = parseListingFilters(new URLSearchParams())
  result.query = filters.query.trim()
  result.city = filters.city
  result.from = filters.date; result.to = filters.date
  result.categories = filters.category ? [filters.category] : []
  result.sort = view === 'upcoming' ? 'soonest' : 'popular'
  let conflict = false
  if (view === 'for-you') {
    conflict = Boolean(filters.city && preferences.city && filters.city !== preferences.city)
      || Boolean(filters.category && preferences.interests.length && !preferences.interests.includes(filters.category))
    result.city = filters.city || preferences.city
    if (!filters.category) result.categories = [...preferences.interests]
  }
  return { filters: result, conflict }
}

// Public venue summaries deliberately use their own API, not the admin's sample store.
export function parsePublicVenues(value: unknown, assetOrigin?: string): PublicVenue[] {
  if (!Array.isArray(value)) throw new Error('Invalid venues response')
  const ids = new Set<string>()
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid venue')
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !eventIdPattern.test(row.id) || ids.has(row.id)
      || typeof row.name !== 'string' || !row.name.trim() || typeof row.city !== 'string' || !row.city.trim()) throw new Error('Invalid venue')
    ids.add(row.id)
    const cityKey = row.city.toLowerCase().trim()
    const city = Object.hasOwn(cityNames, cityKey) ? cityNames[cityKey as keyof typeof cityNames] : { en: row.city, ar: row.city }
    const photo = safeEventImage(row.image)
    const image = photo && assetOrigin && photo.startsWith('/') && !photo.startsWith('/event-images/') ? new URL(photo, assetOrigin).href : photo
    return {
      id: row.id, name: { en: row.name.trim(), ar: typeof row.nameAr === 'string' && row.nameAr.trim() ? row.nameAr.trim() : row.name.trim() },
      city, searchCity: Object.hasOwn(cityNames, cityKey) ? cityKey : '',
      image: image ?? (/opera|أوبرا/i.test(row.name) ? '/event-images/venue-opera.jpg' : /manara|منارة/i.test(row.name) ? '/event-images/venue-arena.jpg' : row.type === 'STANDING' ? '/event-images/venue-garden.jpg' : '/event-images/conference.jpg'), illustrativeImage: !image,
    }
  })
}
