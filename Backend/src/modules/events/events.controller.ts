import { Request, Response } from 'express'
import {
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent
} from './events.service'

/**
 * Public events listing: search, filters and pages
 * GET /api/events?q=jazz&category=concerts&city=cairo&from=2026-11-01&to=2026-11-30&price=paid&page=2
 */
export const getEvents = async (req: Request, res: Response) => {
  try {
    // A query value can arrive as one string or, if repeated, a list: normalise both
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
    const list = (v: unknown) => (Array.isArray(v) ? v : [v]).map(str).filter((x): x is string => !!x)

    const price = req.query.price === 'free' || req.query.price === 'paid' ? req.query.price : undefined

    const result = await listEvents({
      q: str(req.query.q),
      categories: list(req.query.category),
      city: str(req.query.city),
      from: str(req.query.from),
      to: str(req.query.to),
      price,
      page: Number(req.query.page) || 1,
    })
    res.status(200).json(result)
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
    const { venueId, name, category, description, startAt, doorsOpenAt, durationMinutes } = req.body

    if (!venueId || !name || !category || !description || !startAt || !doorsOpenAt || !durationMinutes) {
      res.status(400).json({ message: 'Please fill all required fields' })
      return
    }

    // The logged in admin creates the event
    const createdById = req.user!.id

    const event = await createEvent(createdById, req.body)
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
    res.status(400).json({ message: error.message })
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
    res.status(400).json({ message: error.message })
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
    res.status(400).json({ message: error.message })
  }
}