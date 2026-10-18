import { Router } from 'express'
import { getEvents, getEvent, create, update, remove, publish } from './events.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// GET /api/events - public: visitors browse without an account (BRD §3.3, FR-LST-01)
router.get('/', getEvents)

// GET /api/events/:id - public
router.get('/:id', getEvent)

// POST /api/events - admin only can create events
router.post('/', protect, restrictTo('ADMIN'), create)

// PUT /api/events/:id - admin only can update events
router.put('/:id', protect, restrictTo('ADMIN'), update)

// DELETE /api/events/:id - admin only can delete events
router.delete('/:id', protect, restrictTo('ADMIN'), remove)

// PATCH /api/events/:id/publish - admin only can publish events
router.patch('/:id/publish', protect, restrictTo('ADMIN'), publish)

export default router