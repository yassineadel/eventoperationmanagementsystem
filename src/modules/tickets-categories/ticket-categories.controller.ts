import { Request, Response } from 'express'
import {
  getTicketCategories,
  getTicketCategoryById,
  createTicketCategory,
  updateTicketCategory,
  deleteTicketCategory
} from './ticket-categories.service'

/**
 * Get all ticket categories for an event
 * GET /api/ticket-categories/:event_id
 */
export const getCategories = async (req: Request, res: Response) => {
  try {
    const event_id = req.params['event_id'] as string
    const categories = await getTicketCategories(event_id)
    res.status(200).json(categories)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Get a single ticket category
 * GET /api/ticket-categories/category/:id
 */
export const getCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const category = await getTicketCategoryById(id)
    res.status(200).json(category)
  } catch (error: any) {
    res.status(404).json({ message: error.message })
  }
}

/**
 * Create a new ticket category
 * POST /api/ticket-categories
 */
export const create = async (req: Request, res: Response) => {
  try {
    const {
      event_id,
      name,
      description,
      price,
      total_seats,
      sale_starts_at,
      sale_ends_at
    } = req.body

    if (!event_id || !name || !price || !total_seats) {
      res.status(400).json({ message: 'Please fill all required fields' })
      return
    }

    const category = await createTicketCategory(
      event_id,
      name,
      description,
      price,
      total_seats,
      sale_starts_at,
      sale_ends_at
    )

    res.status(201).json({ message: 'Ticket category created successfully', category })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Update a ticket category
 * PUT /api/ticket-categories/:id
 */
export const update = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const category = await updateTicketCategory(id, req.body)
    res.status(200).json({ message: 'Ticket category updated successfully', category })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Delete a ticket category
 * DELETE /api/ticket-categories/:id
 */
export const remove = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const result = await deleteTicketCategory(id)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}