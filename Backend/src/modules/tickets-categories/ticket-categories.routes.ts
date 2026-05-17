import { Router } from 'express'
import { getCategories, getCategory, create, update, remove } from './ticket-categories.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// GET /api/ticket-categories/:event_id - get all categories for an event
router.get('/:event_id', protect, getCategories)

// GET /api/ticket-categories/category/:id - get a single category
router.get('/category/:id', protect, getCategory)

// POST /api/ticket-categories - admin only
router.post('/', protect, restrictTo('admin'), create)

// PUT /api/ticket-categories/:id - admin only
router.put('/:id', protect, restrictTo('admin'), update)

// DELETE /api/ticket-categories/:id - admin only
router.delete('/:id', protect, restrictTo('admin'), remove)

export default router