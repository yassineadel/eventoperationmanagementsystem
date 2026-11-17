/**
 * Live facts about events, read from the database at the moment of the question: dates, doors,
 * venue, ticket types, prices with service fees, places left and whether tickets can be bought.
 * These change constantly, so they are never stored in the knowledge base.
 */
import { listEvents, PAGE_SIZE, type ListingQuery } from '../../events/events.service'
import { EVENT_CATEGORIES } from '../../admin/admin.service'
import prisma from '../../../config/db'
import { searchEventsByMeaning } from '../knowledge/search'

export { EVENT_CATEGORIES }

const CAIRO = 'Africa/Cairo'
const dateTime = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: CAIRO,
})
const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CAIRO })
const dayOnly = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: CAIRO })

const egp = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EGP`
const hours = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`)

const factsSelect = {
  id: true,
  name: true,
  category: true,
  performer: true,
  status: true,
  cancellationReason: true,
  startAt: true,
  doorsOpenAt: true,
  durationMinutes: true,
  salesOpenAt: true,
  salesCloseAt: true,
  venue: { select: { name: true, address: true, city: true } },
  ticketCategories: {
    select: { name: true, description: true, price: true, serviceFeePercent: true, capacity: true, heldCount: true, soldCount: true },
    orderBy: { price: 'desc' as const },
  },
}

type FactsRow = Awaited<ReturnType<typeof loadRows>>[number]
const loadRows = (ids: string[]) =>
  prisma.event.findMany({ where: { id: { in: ids }, status: { not: 'DRAFT' } }, select: factsSelect })

const left = (c: { capacity: number; heldCount: number; soldCount: number }) => Math.max(0, c.capacity - c.heldCount - c.soldCount)

/** Whether tickets can be bought right now, in words (the same rules as getEventOnSale) */
const saleStatus = (e: FactsRow, now: Date): string => {
  if (e.status === 'CANCELLED') {
    return `CANCELLED${e.cancellationReason ? ` (${e.cancellationReason})` : ''}. Every valid ticket is refunded in full automatically.`
  }
  if (e.startAt <= now) return 'Already started or finished; tickets can no longer be bought.'
  if (e.salesOpenAt && now < e.salesOpenAt) return `Ticket sales open on ${dateTime.format(e.salesOpenAt)} (Cairo time).`
  if (e.salesCloseAt && now > e.salesCloseAt) return 'Ticket sales have closed.'
  if (!e.ticketCategories.length) return 'No tickets have been released yet.'
  if (e.ticketCategories.every((c) => left(c) === 0)) return 'SOLD OUT.'
  return `On sale${e.salesCloseAt ? ` until ${dateTime.format(e.salesCloseAt)} (Cairo time)` : ''}.`
}

/** One event's live facts as text the model reads */
const describe = (e: FactsRow, now: Date): string => {
  const end = new Date(e.startAt.getTime() + e.durationMinutes * 60_000)
  const lines = [
    `${e.name} (event_id ${e.id})`,
    e.performer ? `Performer: ${e.performer}` : null,
    `Category: ${e.category}`,
    `Status: ${saleStatus(e, now)}`,
    `Date: ${dayOnly.format(e.startAt)}`,
    `Doors open: ${timeOnly.format(e.doorsOpenAt)}; starts: ${timeOnly.format(e.startAt)}; ends about ${timeOnly.format(end)} (${hours(e.durationMinutes)}), Cairo time`,
    `Venue: ${e.venue.name}, ${e.venue.address}, ${e.venue.city}`,
  ]
  if (e.ticketCategories.length) {
    lines.push('Ticket types (price + service fee = total per ticket; places left now):')
    for (const c of e.ticketCategories) {
      const price = Number(c.price)
      const fee = Math.round(price * Number(c.serviceFeePercent)) / 100
      const cost = price === 0 ? 'free' : `${egp(price)} + ${Number(c.serviceFeePercent)}% fee (${egp(fee)}) = ${egp(price + fee)}`
      const remaining = left(c)
      lines.push(`- ${c.name}: ${cost}; ${remaining === 0 ? 'sold out' : `${remaining} left`}${c.description ? ` (${c.description})` : ''}`)
    }
  }
  return lines.filter(Boolean).join('\n')
}

/** Live facts for these events, in the order given; drafts and unknown ids are left out */
export const eventFacts = async (ids: string[], now = new Date()): Promise<{ id: string; name: string; text: string }[]> => {
  if (!ids.length) return []
  const rows = await loadRows(ids)
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.flatMap((id) => {
    const e = byId.get(id)
    return e ? [{ id: e.id, name: e.name, text: describe(e, now) }] : []
  })
}

export type EventSearch = {
  query?: string
  category?: (typeof EVENT_CATEGORIES)[number]
  city?: string
  dateFrom?: string
  dateTo?: string
  freeOnly?: boolean
  maxPrice?: number
  sort?: 'soonest' | 'cheapest' | 'popular'
}

/**
 * Upcoming published events matching the filters, through the same listing the website's events
 * page uses, so the bot and the page always agree.
 */
export const searchEvents = async (s: EventSearch) => {
  const sort: ListingQuery['sort'] = s.maxPrice !== undefined || s.sort === 'cheapest' ? 'price-low' : s.sort === 'popular' ? 'popular' : 'soonest'
  const result = await listEvents({
    q: s.query?.trim() || undefined,
    categories: s.category ? [s.category] : undefined,
    city: s.city?.trim() || undefined,
    from: s.dateFrom,
    to: s.dateTo,
    price: s.freeOnly ? 'free' : undefined,
    sort,
  })
  // The listing has no price ceiling, so it is applied here to the cheapest-first page
  const events = result.events.filter((e) => s.maxPrice === undefined || (e.priceFrom ?? 0) <= s.maxPrice)
  const more = s.maxPrice === undefined ? result.total > PAGE_SIZE : events.length === PAGE_SIZE
  return {
    matches: s.maxPrice === undefined ? result.total : undefined,
    shown: events.length,
    events: events.map((e) => ({
      event_id: e.id,
      name: e.name,
      category: e.category,
      performer: e.performer,
      starts: `${dateTime.format(e.startAt)} (Cairo time)`,
      venue: `${e.venue.name}, ${e.venue.city}`,
      price_from: e.priceFrom === null ? 'no tickets released yet' : e.priceFrom === 0 ? 'free' : `${egp(e.priceFrom)} before service fee`,
      sold_out: e.soldOut,
    })),
    note: more ? `Only the first ${PAGE_SIZE} matches are shown; the events page lists all of them.` : undefined,
  }
}

const DAY_MS = 86_400_000
const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

const summarySelect = {
  id: true,
  name: true,
  category: true,
  performer: true,
  description: true,
  startAt: true,
  venue: { select: { name: true, city: true } },
  ticketCategories: { select: { price: true, capacity: true, heldCount: true, soldCount: true } },
} as const

/**
 * Upcoming events that fit a wish described in words ("loud techno", "romantic", "good for kids"),
 * best fit first, optionally limited to a city and dates. Matches descriptions by meaning, then
 * keeps only events that can still be attended.
 */
export const recommendEvents = async (s: { wish: string; city?: string; dateFrom?: string; dateTo?: string; limit?: number }) => {
  const ranked = await searchEventsByMeaning(s.wish)
  if (!ranked.length) return { events: [] }
  const rows = await prisma.event.findMany({
    where: {
      id: { in: ranked.map((r) => r.eventId) },
      status: 'PUBLISHED',
      startAt: {
        gte: isDay(s.dateFrom) ? new Date(Math.max(Date.parse(s.dateFrom!), Date.now())) : new Date(),
        ...(isDay(s.dateTo) ? { lt: new Date(Date.parse(s.dateTo!) + DAY_MS) } : {}),
      },
      ...(s.city?.trim() ? { venue: { city: { equals: s.city.trim(), mode: 'insensitive' as const } } } : {}),
    },
    select: summarySelect,
  })
  const order = new Map(ranked.map((r, i) => [r.eventId, i]))
  const events = rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).slice(0, s.limit ?? 5)
  return {
    events: events.map((e) => {
      const prices = e.ticketCategories.map((c) => Number(c.price))
      return {
        event_id: e.id,
        name: e.name,
        category: e.category,
        performer: e.performer,
        about: e.description.length > 220 ? `${e.description.slice(0, 220)}…` : e.description,
        starts: `${dateTime.format(e.startAt)} (Cairo time)`,
        venue: `${e.venue.name}, ${e.venue.city}`,
        price_from: !prices.length ? 'no tickets released yet' : Math.min(...prices) === 0 ? 'free' : `${egp(Math.min(...prices))} before service fee`,
        sold_out: e.ticketCategories.every((c) => left(c) === 0),
      }
    }),
  }
}

/**
 * A venue found by (part of) its name: address, city, capacity, a map link and its upcoming events.
 * Several matches are all returned (up to 3) so the model can ask which one was meant.
 */
export const venueDetails = async (name: string) => {
  const venues = await prisma.venue.findMany({
    where: { name: { contains: name.trim(), mode: 'insensitive' } },
    select: {
      name: true, type: true, address: true, city: true, capacity: true, latitude: true, longitude: true, mapUrl: true,
      events: {
        where: { status: 'PUBLISHED', startAt: { gte: new Date() } },
        select: { id: true, name: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      },
    },
    take: 3,
  })
  return {
    venues: venues.map((v) => ({
      name: v.name,
      kind: v.type === 'SEATED' ? 'seated venue (each ticket has a seat)' : 'standing venue (tickets are for zones)',
      address: `${v.address}, ${v.city}`,
      capacity: v.capacity,
      map: v.mapUrl ?? `https://www.google.com/maps?q=${Number(v.latitude)},${Number(v.longitude)}`,
      upcoming_events: v.events.map((e) => ({ event_id: e.id, name: e.name, starts: `${dateTime.format(e.startAt)} (Cairo time)` })),
    })),
  }
}
