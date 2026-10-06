import { Router } from 'express'
import { availability, createHold, deleteHold, listMyHolds } from './inventory.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// GET /api/inventory/events/:eventId/availability - public: remaining counts and taken seats
router.get('/events/:eventId/availability', availability)

// Holding tickets is for ordinary users only; administrators cannot purchase (FR-ADM-02)
router.post('/holds', protect, restrictTo('USER'), createHold)
router.get('/holds', protect, restrictTo('USER'), listMyHolds)
router.delete('/holds/:id', protect, restrictTo('USER'), deleteHold)

export default router
