import { Router } from 'express'
import {
  approve, myRefunds, myTicket, myTickets, refund, refundQuote, refundQueue, reject, resend, settle, transfer, transferChain,
} from './tickets.controller'
import { protect, restrictTo } from '../../middleware/auth.middleware'

// Mounted at /api/tickets
export const ticketRoutes = Router()

ticketRoutes.get('/', protect, restrictTo('USER'), myTickets)
ticketRoutes.get('/:id', protect, restrictTo('USER'), myTicket)
ticketRoutes.post('/:id/resend', protect, restrictTo('USER'), resend)
ticketRoutes.post('/:id/transfer', protect, restrictTo('USER'), transfer)
ticketRoutes.get('/:id/refund-quote', protect, restrictTo('USER'), refundQuote)
ticketRoutes.post('/:id/refund', protect, restrictTo('USER'), refund)
// Administrators: who has held this ticket (FR-MTK-15)
ticketRoutes.get('/:id/transfers', protect, restrictTo('ADMIN'), transferChain)

// Mounted at /api/refunds
export const refundRoutes = Router()

refundRoutes.get('/', protect, restrictTo('USER'), myRefunds)
refundRoutes.get('/admin', protect, restrictTo('ADMIN'), refundQueue)
refundRoutes.post('/:id/approve', protect, restrictTo('ADMIN'), approve)
refundRoutes.post('/:id/reject', protect, restrictTo('ADMIN'), reject)
refundRoutes.post('/:id/settle', protect, restrictTo('ADMIN'), settle)
