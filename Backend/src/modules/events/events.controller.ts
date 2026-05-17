import { Request, Response } from 'express'
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent
} from './events.service'

/**
 * Get all published events
 * GET /api/events
 */
export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await getAllEvents()
    res.status(200).json(events)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Get a single event by id
 * GET /api/events/:id
 */
export const getEvent = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const event = await getEventById(id)
    res.status(200).json(event)
  } catch (error: any) {
    res.status(404).json({ message: error.message })
  }
}

/**
 * Create a new event
 * POST /api/events
 */
export const create = async (req: Request, res: Response) => {
  try {
    const { venue_id, title, description, start_at, end_at } = req.body

    if (!venue_id || !title || !start_at || !end_at) {
      res.status(400).json({ message: 'Please fill all required fields' })
      return
    }

    // Get organizer_id from logged in user
    const organizer_id = (req.user as any).id as string

    const event = await createEvent(organizer_id, venue_id, title, description, start_at, end_at)
    res.status(201).json({ message: 'Event created successfully', event })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Update an event
 * PUT /api/events/:id
 */
export const update = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const event = await updateEvent(id, req.body)
    res.status(200).json({ message: 'Event updated successfully', event })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Delete an event
 * DELETE /api/events/:id
 */
export const remove = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const result = await deleteEvent(id)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Publish an event
 * PATCH /api/events/:id/publish
 */
export const publish = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string
    const event = await publishEvent(id)
    res.status(200).json({ message: 'Event published successfully', event })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}