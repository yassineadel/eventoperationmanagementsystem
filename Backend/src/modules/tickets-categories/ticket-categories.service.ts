import prisma from '../../config/db'

/**
 * Get all ticket categories for an event
 */
export const getTicketCategories = async (event_id: string) => {
  return await prisma.ticket_categories.findMany({
    where: { event_id },
    orderBy: { price: 'asc' }
  })
}

/**
 * Get a single ticket category by id
 */
export const getTicketCategoryById = async (id: string) => {
  const category = await prisma.ticket_categories.findUnique({
    where: { id }
  })

  if (!category) throw new Error('Ticket category not found')

  return category
}

/**
 * Create a new ticket category (admin only)
 */
export const createTicketCategory = async (
  event_id: string,
  name: string,
  description: string,
  price: number,
  total_seats: number,
  sale_starts_at?: string,
  sale_ends_at?: string
) => {
  // Check if event exists
  const event = await prisma.events.findUnique({ where: { id: event_id } })
  if (!event) throw new Error('Event not found')

  return await prisma.ticket_categories.create({
    data: {
      event_id,
      name,
      description,
      price,
      total_seats,
      seats_remaining: total_seats,
      sale_starts_at: sale_starts_at ? new Date(sale_starts_at) : null,
      sale_ends_at: sale_ends_at ? new Date(sale_ends_at) : null
    }
  })
}

/**
 * Update a ticket category (admin only)
 */
export const updateTicketCategory = async (id: string, data: {
  name?: string
  description?: string
  price?: number
  total_seats?: number
  sale_starts_at?: string
  sale_ends_at?: string
}) => {
  const category = await prisma.ticket_categories.findUnique({ where: { id } })
  if (!category) throw new Error('Ticket category not found')

  return await prisma.ticket_categories.update({
    where: { id },
    data: {
      ...data,
      sale_starts_at: data.sale_starts_at ? new Date(data.sale_starts_at) : undefined,
      sale_ends_at: data.sale_ends_at ? new Date(data.sale_ends_at) : undefined
    }
  })
}

/**
 * Delete a ticket category (admin only)
 */
export const deleteTicketCategory = async (id: string) => {
  const category = await prisma.ticket_categories.findUnique({ where: { id } })
  if (!category) throw new Error('Ticket category not found')

  await prisma.ticket_categories.delete({ where: { id } })

  return { message: 'Ticket category deleted successfully' }
}