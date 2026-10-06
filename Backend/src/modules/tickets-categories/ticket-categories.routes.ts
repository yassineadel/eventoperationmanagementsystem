import { Router } from 'express'
import { getCategories, getCategory, create, update, remove } from './ticket-categories.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// GET /api/ticket-categories/:event_id - get all categories for an event
router.get('/:event_id', getCategories)

// GET /api/ticket-categories/category/:id - get a single category
router.get('/category/:id', getCategory)

// POST /api/ticket-categories - admin only
router.post('/', protect, restrictTo('ADMIN'), create)

// PUT /api/ticket-categories/:id - admin only
router.put('/:id', protect, restrictTo('ADMIN'), update)

// DELETE /api/ticket-categories/:id - admin only
router.delete('/:id', protect, restrictTo('ADMIN'), remove)

export default router