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

/**
 * Get all published, future events (FR-LST-01, FR-LST-02)
 */
export const getAllEvents = async () => {
  return await prisma.event.findMany({
    where: { status: 'PUBLISHED', startAt: { gte: new Date() } },
    include: {
      venue: true,
      ticketCategories: true
    },
    orderBy: { startAt: 'asc' }
  })
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
