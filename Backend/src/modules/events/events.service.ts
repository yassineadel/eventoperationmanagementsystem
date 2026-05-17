import prisma from '../../config/db'

/**
 * Get all published events
 */
export const getAllEvents = async () => {
  return await prisma.events.findMany({
    where: { status: 'published' },
    include: {
      venues: true,
      ticket_categories: true
    },
    orderBy: { start_at: 'asc' }
  })
}

/**
 * Get a single event by id
 */
export const getEventById = async (id: string) => {
  const event = await prisma.events.findUnique({
    where: { id },
    include: {
      venues: true,
      ticket_categories: true,
      users: {
        select: {
          first_name: true,
          last_name: true,
          email: true
        }
      }
    }
  })

  if (!event) throw new Error('Event not found')

  return event
}

/**
 * Create a new event (admin only)
 */
export const createEvent = async (
  organizer_id: string,
  venue_id: string,
  title: string,
  description: string,
  start_at: string,
  end_at: string
) => {
  return await prisma.events.create({
    data: {
      organizer_id,
      venue_id,
      title,
      description,
      start_at: new Date(start_at),
      end_at: new Date(end_at),
      status: 'draft'
    }
  })
}

/**
 * Update an event (admin only)
 */
export const updateEvent = async (id: string, data: {
  title?: string
  description?: string
  start_at?: string
  end_at?: string
  status?: string
  venue_id?: string
}) => {
  const event = await prisma.events.findUnique({ where: { id } })
  if (!event) throw new Error('Event not found')

  return await prisma.events.update({
    where: { id },
    data: {
      ...data,
      start_at: data.start_at ? new Date(data.start_at) : undefined,
      end_at: data.end_at ? new Date(data.end_at) : undefined
    }
  })
}

/**
 * Delete an event (admin only)
 */
export const deleteEvent = async (id: string) => {
  const event = await prisma.events.findUnique({ where: { id } })
  if (!event) throw new Error('Event not found')

  await prisma.events.delete({ where: { id } })

  return { message: 'Event deleted successfully' }
}

/**
 * Publish an event (admin only)
 */
export const publishEvent = async (id: string) => {
  const event = await prisma.events.findUnique({ where: { id } })
  if (!event) throw new Error('Event not found')

  return await prisma.events.update({
    where: { id },
    data: { status: 'published' }
  })
}