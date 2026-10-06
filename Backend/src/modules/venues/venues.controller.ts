import { Request, Response } from 'express'
import { NotFoundError, getAllVenues, getVenueBySlug, getVenueCategories, getVenueLayout } from './venues.service'

const handleError = (res: Response, error: unknown) => {
  if (error instanceof NotFoundError) {
    res.status(404).json({ message: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Something went wrong' })
}

/**
 * List venues, optionally ?city=Cairo
 * GET /api/venues
 */
export const getVenues = async (req: Request, res: Response) => {
  try {
    const city = typeof req.query['city'] === 'string' ? req.query['city'] : undefined
    res.status(200).json(await getAllVenues(city))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * One venue with its upcoming events
 * GET /api/venues/:slug
 */
export const getVenue = async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getVenueBySlug(req.params['slug'] as string))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * Category keys the venue offers, for pricing an event
 * GET /api/venues/:slug/categories
 */
export const getCategories = async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getVenueCategories(req.params['slug'] as string))
  } catch (error) {
    handleError(res, error)
  }
}

/**
 * Seats or zones, for drawing the venue map
 * GET /api/venues/:slug/layout
 */
export const getLayout = async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getVenueLayout(req.params['slug'] as string))
  } catch (error) {
    handleError(res, error)
  }
}
