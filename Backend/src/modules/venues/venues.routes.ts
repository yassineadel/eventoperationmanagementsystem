import { Router } from 'express'
import { getVenues, getVenue, getCategories, getLayout } from './venues.controller'

const router = Router()

// All public: visitors browse venues without logging in (BRD §3.3).
// Venues are authored as layout files and loaded with `npm run seed:venues`, so there are no write routes.

// GET /api/venues?city=Cairo
router.get('/', getVenues)

// GET /api/venues/:slug
router.get('/:slug', getVenue)

// GET /api/venues/:slug/categories
router.get('/:slug/categories', getCategories)

// GET /api/venues/:slug/layout
router.get('/:slug/layout', getLayout)

export default router
