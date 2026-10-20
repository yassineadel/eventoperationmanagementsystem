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

export interface ListingQuery {
  q?: string
  categories?: string[]
  city?: string
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD, inclusive
  price?: 'free' | 'paid'
  page?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

export const listEvents = async ({ q, categories, city, from, to, price, page = 1 }: ListingQuery) => {
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

  // Category: one or several, e.g. ?category=concerts&category=arts (FR-LST-04)
  if (categories?.length) and.push({ category: { in: categories } })

  // City: "cairo" matches "Cairo" (FR-LST-05)
  if (city) and.push({ venue: { city: { equals: city, mode: 'insensitive' } } })

  // Date range, whole days: from 00:00 of `from` until the end of `to` (FR-LST-06)
  if (isDay(from)) and.push({ startAt: { gte: new Date(from!) } })
  if (isDay(to)) and.push({ startAt: { lt: new Date(Date.parse(to!) + DAY_MS) } })

  // Free = every ticket category costs 0; paid = at least one costs more (FR-LST-07)
  if (price === 'free') and.push({ ticketCategories: { some: {}, every: { price: 0 } } })
  if (price === 'paid') and.push({ ticketCategories: { some: { price: { gt: 0 } } } })

  const where: Prisma.EventWhereInput = {
    status: 'PUBLISHED',
    startAt: { gte: new Date() }, // past events never listed (FR-LST-02)
    AND: and,
  }

  const total = await prisma.event.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pageCount)

  const events = await prisma.event.findMany({
    where,
    orderBy: { startAt: 'asc' },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      category: true,
      performer: true,
      images: true,
      startAt: true,
      venue: { select: { name: true, city: true } },
      ticketCategories: { select: { price: true, capacity: true, heldCount: true, soldCount: true } },
    },
  })

  return {
    events: events.map((e) => ({
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
    })),
    total,
    page: current,
    pageCount,
    pageSize: PAGE_SIZE,
  }
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
