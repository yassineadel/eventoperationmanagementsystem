import prisma from '../../config/db'
import { getVenueCategories } from '../venues/venues.service'

/**
 * Get all ticket categories for a published (or cancelled) event — public
 */
export const getTicketCategories = async (eventId: string) => {
  return await prisma.ticketCategory.findMany({
    where: { eventId, event: { status: { not: 'DRAFT' } } },
    orderBy: { price: 'asc' }
  })
}

/**
 * Get a single ticket category by id — public
 */
export const getTicketCategoryById = async (id: string) => {
  const category = await prisma.ticketCategory.findFirst({
    where: { id, event: { status: { not: 'DRAFT' } } }
  })

  if (!category) throw new Error('Ticket category not found')

  return category
}

/**
 * Create a new ticket category (admin only).
 * The categoryKey must be one the event's venue offers, and capacity comes from the venue
 * layout, so a priced category always maps to real seats or zones (FR-ADM-06/07).
 */
export const createTicketCategory = async (data: {
  eventId: string
  categoryKey: string
  name: string
  description?: string
  price: number
  serviceFeePercent: number
}) => {
  const event = await prisma.event.findUnique({
    where: { id: data.eventId },
    include: { venue: { select: { slug: true } } }
  })
  if (!event) throw new Error('Event not found')
  if (event.status !== 'DRAFT') throw new Error('Categories cannot be added after the event is published')

  const venueCategory = (await getVenueCategories(event.venue.slug)).find((c) => c.key === data.categoryKey)
  if (!venueCategory) {
    throw new Error(`The venue has no category "${data.categoryKey}"`)
  }

  return await prisma.ticketCategory.create({
    data: {
      eventId: data.eventId,
      categoryKey: data.categoryKey,
      name: data.name,
      description: data.description,
      price: data.price,
      serviceFeePercent: data.serviceFeePercent,
      capacity: venueCategory.capacity,
      remaining: venueCategory.capacity
    }
  })
}

/**
 * Update a ticket category (admin only). Price and fee are frozen once published (FR-ADM-08, BR-15).
 */
export const updateTicketCategory = async (id: string, data: {
  name?: string
  description?: string
  price?: number
  serviceFeePercent?: number
}) => {
  const category = await prisma.ticketCategory.findUnique({ where: { id }, include: { event: true } })
  if (!category) throw new Error('Ticket category not found')

  if (category.event.status !== 'DRAFT' && (data.price !== undefined || data.serviceFeePercent !== undefined)) {
    throw new Error('Price and service fee cannot change after the event is published')
  }

  return await prisma.ticketCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      serviceFeePercent: data.serviceFeePercent
    }
  })
}

/**
 * Delete a ticket category (admin only) — drafts only
 */
export const deleteTicketCategory = async (id: string) => {
  const category = await prisma.ticketCategory.findUnique({ where: { id }, include: { event: true } })
  if (!category) throw new Error('Ticket category not found')
  if (category.event.status !== 'DRAFT') throw new Error('Categories cannot be removed after the event is published')

  await prisma.ticketCategory.delete({ where: { id } })

  return { message: 'Ticket category deleted successfully' }
}
