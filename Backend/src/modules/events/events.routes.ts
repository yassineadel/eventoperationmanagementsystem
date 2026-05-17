import { Router } from 'express'
import { getEvents, getEvent, create, update, remove, publish } from './events.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// GET /api/events - anyone logged in can see events
router.get('/', protect, getEvents)

// GET /api/events/:id - anyone logged in can see a single event
router.get('/:id', protect, getEvent)

// POST /api/events - admin only can create events
router.post('/', protect, restrictTo('admin'), create)

// PUT /api/events/:id - admin only can update events
router.put('/:id', protect, restrictTo('admin'), update)

// DELETE /api/events/:id - admin only can delete events
router.delete('/:id', protect, restrictTo('admin'), remove)

// PATCH /api/events/:id/publish - admin only can publish events
router.patch('/:id/publish', protect, restrictTo('admin'), publish)

export default router