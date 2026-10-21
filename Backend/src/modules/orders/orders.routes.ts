import { Router } from 'express'
import { cancelOrder, cart, createCheckout, getOrder, listOrders } from './orders.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

const router = Router()

// Buying needs a logged in, verified account (FR-CHK-01); administrators cannot buy (FR-ADM-02)
router.use(protect, restrictTo('USER'))

router.get('/cart', cart)
router.post('/checkout', createCheckout)
router.get('/', listOrders)
router.get('/:id', getOrder)
router.post('/:id/cancel', cancelOrder)

export default router
