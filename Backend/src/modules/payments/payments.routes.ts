import { Router } from 'express'
import { config, simulate, stripeWebhook } from './payments.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// GET /api/payments/config - public
router.get('/config', config)

// POST /api/payments/stripe/webhook - called by Stripe, verified by signature (raw body set up in app.ts)
router.post('/stripe/webhook', stripeWebhook)

// POST /api/payments/simulator/:providerTxId - development only
router.post('/simulator/:providerTxId', protect, restrictTo('USER'), simulate)

export default router
