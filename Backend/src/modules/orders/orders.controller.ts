import { Request, Response } from 'express'
import { OrderError, cancelMyOrder, checkout, getCart, getMyOrder, getMyOrders } from './orders.service'
import { isBadId } from '../../utils/badId'

const handleError = (res: Response, error: unknown) => {
  if (error instanceof OrderError) {
    res.status(error.status).json({ message: error.message })
    return
  }
  if (isBadId(error)) {
    res.status(404).json({ message: 'Not found' })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Something went wrong' })
}

/**
 * Itemised cart for an event
 * GET /api/orders/cart?eventId=...
 */
export const cart = async (req: Request, res: Response) => {
  try {
    const eventId = req.query['eventId']
    if (typeof eventId !== 'string') {
      res.status(400).json({ message: 'eventId is required' })
      return
    }
    res.status(200).json(await getCart(req.user!.id, eventId))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * Create the order from held tickets and start payment
 * POST /api/orders/checkout { eventId, idempotencyKey, policyAccepted, attendees: [{ holdId, names }] }
 */
export const createCheckout = async (req: Request, res: Response) => {
  try {
    const result = await checkout(req.user!.id, req.body)
    res.status(201).json(result)
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * GET /api/orders
 */
export const listOrders = async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getMyOrders(req.user!.id))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * GET /api/orders/:id
 */
export const getOrder = async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getMyOrder(req.user!.id, req.params['id'] as string))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * Abandon an unpaid order
 * POST /api/orders/:id/cancel
 */
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    await cancelMyOrder(req.user!.id, req.params['id'] as string)
    res.status(200).json({ message: 'Order cancelled and tickets released' })
  } catch (error) {
    handleError(res, error)
  }
}
