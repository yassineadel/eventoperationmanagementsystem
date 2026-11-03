import type { Category, City, Event, LocalizedText } from '../Components/Homepage/types.ts'
import { categoryNames, cityNames } from '../Components/Homepage/strings.ts'
import { listingSearchParams, type ListingFilters } from '../Components/Discovery/listing.ts'
import { eventPlaceholderImage } from './eventImages.ts'
export { fallbackImages } from './eventImages.ts'

export const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type CategoryCounts = Record<Category, number>
export type CatalogDetails = {
  gallery: string[]; fallbackImage: boolean; address: LocalizedText | null;
  coordinates: readonly [number, number] | null; duration: number | null;
  doorsOpen: string | null; capacity: number | null; organiser: LocalizedText | null;
  policies: { title: LocalizedText; body: LocalizedText }[];
  faqs: { question: LocalizedText; answer: LocalizedText }[];
  ticketCategories?: { id: string; name: LocalizedText; price: number | null; feePercent: number | null; capacity: number; held: number; sold: number; remaining: number }[];
  venueType?: 'SEATED' | 'STANDING'; synthetic?: boolean;
  // The venue's id in URLs, used to load the seat map (GET /api/venues/:slug/layout)
  venueSlug?: string;
}
export type CatalogEvent = { event: Event; details: CatalogDetails }
export type EventsPage = {
  events: Event[]; total: number; page: number; pageCount: number; pageSize: number;
  start: number; end: number; invalidDates: boolean; categoryCounts?: CategoryCounts;
}

type Row = Record<string, unknown>
function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid events response')
  return value as Row
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function requiredText(value: unknown): string { const result = text(value); if (!result) throw new Error('Missing event content'); return result }
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid event count')
  return value
}
function date(value: unknown): string { const result = requiredText(value); if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid event date'); return result }
export function decimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) throw new Error('Invalid event price')
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid event price')
  return amount
}
function localized(value: unknown, arabic?: unknown): LocalizedText {
  if (value && typeof value === 'object') { const r = record(value); const en = text(r.en) || text(r.ar); return { en, ar: text(r.ar) || en } }
  const en = text(value)
  return { en, ar: text(arabic) || en }
}
export function safeEventImage(value: unknown): string | null {
  const image = text(value)
  return /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/i.test(image) ? image : null
}
function category(value: unknown): Category {
  const result = requiredText(value).toLowerCase()
  if (!Object.hasOwn(categoryNames, result)) throw new Error('Unsupported event category')
  return result as Category
}
function city(value: unknown): City {
  const result = requiredText(value).toLowerCase()
  if (!Object.hasOwn(cityNames, result)) throw new Error('Unsupported event city')
  return result as City
}
function id(value: unknown): string {
  const result = requiredText(value)
  if (!eventIdPattern.test(result)) throw new Error('Invalid event ID')
  return result.toLowerCase()
}
export function mapEventSummary(value: unknown): Event {
  const row = record(value), venue = record(row.venue), eventCategory = category(row.category)
  if (typeof row.soldOut !== 'boolean') throw new Error('Invalid event availability')
  return {
    id: id(row.id), title: localized(requiredText(row.name), row.nameAr), description: { en: '', ar: '' },
    performer: localized(row.performer, row.performerAr), venue: localized(requiredText(venue.name), venue.nameAr),
    category: eventCategory, city: city(venue.city), date: date(row.startAt), price: decimal(row.priceFrom),
    status: row.status === 'CANCELLED' ? 'cancelled' : row.soldOut ? 'sold-out' : 'available', source: 'api',
    image: safeEventImage(row.image) ?? eventPlaceholderImage(text(row.name), eventCategory), activity: { views: 0, registrations: integer(row.popularity ?? 0) },
  }
}
export function parseCategoryCounts(value: unknown): CategoryCounts | undefined {
  if (value === undefined || value === null) return undefined
  const row = record(value)
  return Object.fromEntries(Object.keys(categoryNames).map((key) => [key, integer(row[key] ?? 0)])) as CategoryCounts
}
export function parseEventsPage(value: unknown): EventsPage {
  const row = record(value)
  if (!Array.isArray(row.events)) throw new Error('Invalid events page')
  const total = integer(row.total), page = integer(row.page), pageCount = integer(row.pageCount), size = integer(row.pageSize)
  if (!page || !pageCount || size !== 6 || page > pageCount || pageCount !== Math.max(1, Math.ceil(total / size))) throw new Error('Invalid pagination')
  const events = row.events.map(mapEventSummary)
  if (events.length !== Math.min(size, Math.max(0, total - (page - 1) * size)) || new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Inconsistent events page')
  return { events, total, page, pageCount, pageSize: size, start: total ? (page - 1) * size + 1 : 0, end: Math.min(page * size, total), invalidDates: false, categoryCounts: parseCategoryCounts(row.categoryCounts) }
}

function policyRows(value: unknown): CatalogDetails['policies'] {
  if (Array.isArray(value)) return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = record(item), title = localized(row.title), body = localized(row.body ?? row.content ?? row.description)
    return title.en && body.en ? [{ title, body }] : []
  })
  if (!value || typeof value !== 'object') return []
  const labels: Record<string, LocalizedText> = {
    ageRestrictions: { en: 'Admission & age', ar: 'الدخول والعمر' }, prohibitedItems: { en: 'Prohibited items', ar: 'المواد المحظورة' },
    entryConditions: { en: 'Entry conditions', ar: 'شروط الدخول' }, refundPolicy: { en: 'Refund policy', ar: 'سياسة الاسترداد' }, accessibility: { en: 'Accessibility', ar: 'إمكانية الوصول' },
  }
  return Object.entries(record(value)).flatMap(([key, content]) => {
    const body = localized(content), title = labels[key] ?? { en: 'Event policy', ar: 'سياسة الفعالية' }
    return body.en ? [{ title, body }] : []
  })
}
export function mapEventDetail(value: unknown): CatalogEvent {
  const row = record(value), venue = record(row.venue)
  if (row.status !== 'PUBLISHED' && row.status !== 'CANCELLED') throw new Error('Event is not public')
  if (!Array.isArray(row.ticketCategories)) throw new Error('Missing ticket categories')
  const ticketCategories = row.ticketCategories.map((value) => {
    const c = record(value), capacity = integer(c.capacity), held = integer(c.heldCount), sold = integer(c.soldCount)
    if (held + sold > capacity) throw new Error('Invalid ticket inventory')
    return { id: id(c.id), name: localized(requiredText(c.name), c.nameAr), price: decimal(c.price), feePercent: decimal(c.serviceFeePercent), capacity, held, sold, remaining: capacity - held - sold }
  })
  const prices = ticketCategories.map((c) => c.price).filter((price): price is number => price !== null)
  const gallery = Array.isArray(row.images) ? row.images.map(safeEventImage).filter((image): image is string => Boolean(image)) : []
  const cover = gallery[0] ?? safeEventImage(row.image)
  const event = mapEventSummary({ ...row, image: cover, priceFrom: prices.length ? Math.min(...prices) : null, soldOut: ticketCategories.every((c) => c.remaining === 0), popularity: ticketCategories.reduce((sum, c) => sum + c.held + c.sold, 0) })
  event.description = localized(row.about || row.description, row.aboutAr || row.descriptionAr)
  const latitude = decimalCoordinate(venue.latitude, 90), longitude = decimalCoordinate(venue.longitude, 180)
  const faqs = Array.isArray(row.faqs) ? row.faqs.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const r = record(item), question = localized(r.question), answer = localized(r.answer)
    return question.en && answer.en ? [{ question, answer }] : []
  }) : []
  return { event, details: {
    gallery: gallery.length ? [...new Set(gallery)] : [event.image], fallbackImage: !cover,
    address: venue.address ? localized(venue.address, venue.addressAr) : null,
    coordinates: latitude !== null && longitude !== null ? [latitude, longitude] : null,
    duration: typeof row.durationMinutes === 'number' && row.durationMinutes > 0 ? row.durationMinutes : null,
    doorsOpen: row.doorsOpenAt ? date(row.doorsOpenAt) : null,
    capacity: typeof venue.capacity === 'number' ? integer(venue.capacity) : ticketCategories.reduce((sum, c) => sum + c.capacity, 0),
    organiser: null, policies: policyRows(row.policies), faqs, ticketCategories,
    venueType: venue.type === 'SEATED' || venue.type === 'STANDING' ? venue.type : undefined, synthetic: row.isSynthetic === true,
    venueSlug: text(venue.slug) || undefined,
  } }
}
function decimalCoordinate(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= max ? number : null
}
export function listingApiQuery(filters: ListingFilters, facets = false): string {
  const params = listingSearchParams({ ...filters, categories: facets ? [] : filters.categories, page: facets ? 1 : filters.page, sort: facets ? 'soonest' : filters.sort, savedOnly: false })
  params.set('sort', facets ? 'soonest' : filters.sort)
  params.set('page', String(facets ? 1 : filters.page))
  return params.toString()
}
