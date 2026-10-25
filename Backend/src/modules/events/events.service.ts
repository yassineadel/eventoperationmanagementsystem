import { Prisma } from '@prisma/client'
import prisma from '../../config/db'

export interface EventInput {
  venueId?: string
  name?: string
  category?: string
  performer?: string | null
  description?: string
  about?: string | null
  images?: string[]
  startAt?: string
  doorsOpenAt?: string
  durationMinutes?: number
  policies?: Prisma.InputJsonValue
  faqs?: Prisma.InputJsonValue
  salesOpenAt?: string | null
  salesCloseAt?: string | null
}

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v))

// Only whitelisted fields reach the database; status changes go through publish
const toData = (data: EventInput) => ({
  venueId: data.venueId,
  name: data.name,
  category: data.category,
  performer: data.performer,
  description: data.description,
  about: data.about,
  images: data.images,
  startAt: toDate(data.startAt) ?? undefined,
  doorsOpenAt: toDate(data.doorsOpenAt) ?? undefined,
  durationMinutes: data.durationMinutes,
  policies: data.policies,
  faqs: data.faqs,
  salesOpenAt: toDate(data.salesOpenAt),
  salesCloseAt: toDate(data.salesCloseAt),
})

// ─── Public listing (FR-LST-01 to FR-LST-12) ────────────────────────────────

export const PAGE_SIZE = 6 // matches the website's listing page

// Same values the website's sort menu uses (FR-LST-09 to FR-LST-11)
export const SORTS = ['soonest', 'popular', 'price-low', 'price-high', 'name'] as const
export type SortOrder = (typeof SORTS)[number]

export interface ListingQuery {
  q?: string
  categories?: string[]
  city?: string
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD, inclusive
  price?: 'free' | 'paid'
  sort?: SortOrder
  page?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

const listingSelect = {
  id: true,
  name: true,
  category: true,
  performer: true,
  images: true,
  startAt: true,
  venue: { select: { name: true, city: true } },
  ticketCategories: { select: { price: true, capacity: true, heldCount: true, soldCount: true } },
} satisfies Prisma.EventSelect

type ListingRow = Prisma.EventGetPayload<{ select: typeof listingSelect }>

const toSummary = (e: ListingRow) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  performer: e.performer,
  image: e.images[0] ?? null,
  startAt: e.startAt,
  venue: e.venue,
  // the cheapest ticket, shown as "from 300 EGP"
  priceFrom: e.ticketCategories.length ? Math.min(...e.ticketCategories.map((c) => Number(c.price))) : null,
  // sold out when no category has a free place left (FR-LST-15)
  soldOut: e.ticketCategories.every((c) => c.capacity - c.heldCount - c.soldCount <= 0),
  // tickets sold or currently held; used for "popular"
  popularity: e.ticketCategories.reduce((n, c) => n + c.soldCount + c.heldCount, 0),
})

export const listEvents = async ({ q, categories, city, from, to, price, sort = 'soonest', page = 1 }: ListingQuery) => {
  const search = q?.trim()

  // Each filter is added only when it was sent; together they combine with AND (FR-LST-08)
  const and: Prisma.EventWhereInput[] = []

  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { performer: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { venue: { name: { contains: search, mode: 'insensitive' } } },
      ],
    })
  }

  // City: "cairo" matches "Cairo" (FR-LST-05)
  if (city) and.push({ venue: { city: { equals: city, mode: 'insensitive' } } })

  // Date range, whole days: from 00:00 of `from` until the end of `to` (FR-LST-06)
  if (isDay(from)) and.push({ startAt: { gte: new Date(from!) } })
  if (isDay(to)) and.push({ startAt: { lt: new Date(Date.parse(to!) + DAY_MS) } })

  // Free = every ticket category costs 0; paid = at least one costs more (FR-LST-07)
  if (price === 'free') and.push({ ticketCategories: { some: {}, every: { price: 0 } } })
  if (price === 'paid') and.push({ ticketCategories: { some: { price: { gt: 0 } } } })

  // Every filter except the category choice. The category counts below use this.
  const base: Prisma.EventWhereInput = {
    status: 'PUBLISHED',
    startAt: { gte: new Date() }, // past events never listed (FR-LST-02)
    AND: and,
  }

  // Category: one or several, e.g. ?category=concerts&category=arts (FR-LST-04)
  const where: Prisma.EventWhereInput = categories?.length ? { ...base, category: { in: categories } } : base

  // Events per category across ALL matching results, not just this page. The category filter
  // itself is left out, so ticking "Concerts" still shows how many arts or sports events exist.
  const grouped = await prisma.event.groupBy({ by: ['category'], where: base, _count: { _all: true } })
  const categoryCounts: Record<string, number> = Object.fromEntries(grouped.map((g) => [g.category, g._count._all]))
  const total = await prisma.event.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pageCount)
  const skip = (current - 1) * PAGE_SIZE

  let events: ReturnType<typeof toSummary>[]

  if (sort === 'soonest' || sort === 'name') {
    // The database can sort by its own columns, so it only returns the one page we need
    const rows = await prisma.event.findMany({
      where,
      orderBy: sort === 'name' ? [{ name: 'asc' }, { startAt: 'asc' }] : [{ startAt: 'asc' }, { id: 'asc' }],
      skip,
      take: PAGE_SIZE,
      select: listingSelect,
    })
    events = rows.map(toSummary)
  } else {
    // Price and popularity are calculated from ticket categories, so sort them here.
    // Fine at our size (tens of events); move into SQL if listings ever reach thousands.
    const rows = await prisma.event.findMany({ where, select: listingSelect })
    const byDate = (a: ReturnType<typeof toSummary>, b: ReturnType<typeof toSummary>) =>
      a.startAt.getTime() - b.startAt.getTime()
    const all = rows.map(toSummary).sort((a, b) => {
      if (sort === 'popular') return b.popularity - a.popularity || byDate(a, b)
      const pa = a.priceFrom ?? 0
      const pb = b.priceFrom ?? 0
      return (sort === 'price-low' ? pa - pb : pb - pa) || byDate(a, b)
    })
    events = all.slice(skip, skip + PAGE_SIZE)
  }

    return { events, total, page: current, pageCount, pageSize: PAGE_SIZE, sort, categoryCounts }
}

/**
 * Get a single event by id. Public, so drafts are hidden (cancelled events still show, FR-EVT-11).
 */
export const getEventById = async (id: string) => {
  const event = await prisma.event.findFirst({
    where: { id, status: { not: 'DRAFT' } },
    include: {
      venue: true,
      ticketCategories: true
    }
  })

  if (!event) throw new Error('Event not found')

  return event
}

/**
 * Create a new event as a draft (admin only)
 */
export const createEvent = async (createdById: string, data: Required<Pick<EventInput,
  'venueId' | 'name' | 'category' | 'description' | 'startAt' | 'doorsOpenAt' | 'durationMinutes'>> & EventInput) => {
  return await prisma.event.create({
    data: {
      ...toData(data),
      venueId: data.venueId,
      name: data.name,
      category: data.category,
      description: data.description,
      startAt: new Date(data.startAt),
      doorsOpenAt: new Date(data.doorsOpenAt),
      durationMinutes: data.durationMinutes,
      createdById,
      status: 'DRAFT'
    }
  })
}

/**
 * Update an event (admin only). Descriptive fields stay editable after publishing (FR-ADM-09).
 */
export const updateEvent = async (id: string, data: EventInput) => {
  const event = await prisma.event.findUnique({ where: { id } })
  if (!event) throw new Error('Event not found')

  if (event.status !== 'DRAFT' && data.venueId && data.venueId !== event.venueId) {
    throw new Error('The venue cannot be changed after the event is published')
  }

  return await prisma.event.update({
    where: { id },
    data: toData(data)
  })
}

/**
 * Delete an event (admin only). Only drafts can be deleted; published events are
 * cancelled instead and kept for analysis (FR-ADM-12, BR-19).
 */
export const deleteEvent = async (id: string) => {
  const event = await prisma.event.findUnique({ where: { id } })
  if (!event) throw new Error('Event not found')
  if (event.status !== 'DRAFT') throw new Error('Only draft events can be deleted')

  await prisma.$transaction([
    prisma.ticketCategory.deleteMany({ where: { eventId: id } }),
    prisma.event.delete({ where: { id } })
  ])

  return { message: 'Event deleted successfully' }
}

/**
 * Publish an event (admin only)
 */
export const publishEvent = async (id: string) => {
  const event = await prisma.event.findUnique({ where: { id } })
  if (!event) throw new Error('Event not found')
  if (event.status !== 'DRAFT') throw new Error('Only draft events can be published')

  return await prisma.event.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() }
  })
}

/**
 * For other modules (inventory, ordering): the event if tickets can be bought right now, else an error.
 * Published, not started, and inside the sales window (FR-EVT-11, FR-ADM-11).
 */
export const getEventOnSale = async (id: string) => {
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, venueId: true, status: true, startAt: true, salesOpenAt: true, salesCloseAt: true }
  })
  const now = new Date()
  if (!event || event.status === 'DRAFT') throw new Error('Event not found')
  if (event.status === 'CANCELLED') throw new Error('This event has been cancelled')
  if (event.startAt <= now) throw new Error('This event has already started')
  if (event.salesOpenAt && now < event.salesOpenAt) throw new Error('Ticket sales have not opened yet')
  if (event.salesCloseAt && now > event.salesCloseAt) throw new Error('Ticket sales have closed')
  return event
}

// ─── Admin list (FR-ADM-10) ─────────────────────────────────────────────────

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const
export type EventStatusFilter = (typeof EVENT_STATUSES)[number]

/**
 * Every event for the admin console: drafts, published, cancelled and past ones.
 * Newest first, with how many tickets are sold, so the list shows progress at a glance.
 */
export const listEventsForAdmin = async ({ status, q, page = 1 }: { status?: EventStatusFilter; q?: string; page?: number }) => {
  const ADMIN_PAGE_SIZE = 20
  const search = q?.trim()

  const where: Prisma.EventWhereInput = {
    ...(status && { status }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  }

  const total = await prisma.event.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pageCount)

  const rows = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (current - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
      startAt: true,
      publishedAt: true,
      createdAt: true,
      venue: { select: { name: true } },
      ticketCategories: { select: { capacity: true, soldCount: true } },
    },
  })

  const now = Date.now()
  return {
    events: rows.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      status: e.status,
      isPast: e.startAt.getTime() < now,
      startAt: e.startAt,
      publishedAt: e.publishedAt,
      createdAt: e.createdAt,
      venue: e.venue.name,
      sold: e.ticketCategories.reduce((n, c) => n + c.soldCount, 0),
      capacity: e.ticketCategories.reduce((n, c) => n + c.capacity, 0),
    })),
    total,
    page: current,
    pageCount,
    pageSize: ADMIN_PAGE_SIZE,
  }
}