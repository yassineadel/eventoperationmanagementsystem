import { Request, Response } from 'express'
import { InventoryError, getAvailability, getMyHolds, holdSeats, holdStanding, releaseHold } from './inventory.service'

const handleError = (res: Response, error: unknown) => {
  if (error instanceof InventoryError) {
    res.status(error.status).json({ message: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Something went wrong' })
}

/**
 * Hold tickets during checkout
 * POST /api/inventory/holds
 * Standing: { eventId, ticketCategoryId, quantity }   Seated: { eventId, seatIds: [...] }
 */
export const createHold = async (req: Request, res: Response) => {
  try {
    const { eventId, ticketCategoryId, quantity, seatIds } = req.body
    if (!eventId) {
      res.status(400).json({ message: 'eventId is required' })
      return
    }

    const holds = Array.isArray(seatIds)
      ? await holdSeats(req.user!.id, eventId, seatIds)
      : ticketCategoryId
        ? [await holdStanding(req.user!.id, eventId, ticketCategoryId, Number(quantity))]
        : null

    if (!holds) {
      res.status(400).json({ message: 'Send either seatIds or ticketCategoryId and quantity' })
      return
    }
    res.status(201).json({ message: 'Tickets held', holds })
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * The logged in user's active holds for an event
 * GET /api/inventory/holds?eventId=...
 */
export const listMyHolds = async (req: Request, res: Response) => {
  try {
    const eventId = req.query['eventId']
    if (typeof eventId !== 'string') {
      res.status(400).json({ message: 'eventId is required' })
      return
    }
    res.status(200).json(await getMyHolds(req.user!.id, eventId))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * Remove a held item from the selection
 * DELETE /api/inventory/holds/:id
 */
export const deleteHold = async (req: Request, res: Response) => {
  try {
    await releaseHold(req.user!.id, req.params['id'] as string)
    res.status(200).json({ message: 'Hold released' })
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * Live availability for an event — public
 * GET /api/inventory/events/:eventId/availability
 */
export const availability = async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getAvailability(req.params['eventId'] as string))
  } catch (error) {
    handleError(res, error)
  }
}
