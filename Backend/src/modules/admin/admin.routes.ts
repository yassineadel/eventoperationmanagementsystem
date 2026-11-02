import { Router, type Request, type Response } from 'express'
import { protect, restrictTo } from '../../middleware/auth.middleware'
import { TicketError } from '../tickets/tickets.service'
import { isBadId } from '../../utils/badId'
import * as admin from './admin.service'

// Mounted at /api/admin. Every route needs a signed-in administrator; the role is re-read from the
// database on each request, so removing someone's admin access applies at once.
const router = Router()
router.use(protect, restrictTo('ADMIN'))

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const result = await fn(req)
    res.status(okStatus).json(result ?? { message: 'Done' })
  } catch (error) {
    if (error instanceof admin.AdminError || error instanceof TicketError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    if (isBadId(error)) {
      res.status(404).json({ message: 'Not found' })
      return
    }
    console.error(error)
    res.status(500).json({ message: 'Something went wrong' })
  }
}

const me = (req: Request) => req.user!.id
const id = (req: Request) => req.params['id'] as string
const body = (req: Request) => (req.body ?? {}) as Record<string, unknown>
const query = (req: Request) => req.query as Record<string, unknown>

router.get('/dashboard', handle(() => admin.getDashboard()))
router.get('/lookups', handle(() => admin.lookups()))
router.get('/activity', handle((req) => admin.listActivity(query(req))))

// Events and their ticket types
router.get('/events', handle((req) => admin.listEvents(query(req))))
router.post('/events', handle((req) => admin.createAdminEvent(me(req), body(req)), 201))
router.get('/events/:id', handle((req) => admin.getEvent(id(req))))
router.put('/events/:id', handle((req) => admin.updateAdminEvent(me(req), id(req), body(req))))
router.post('/events/:id/publish', handle((req) => admin.publishAdminEvent(me(req), id(req))))
router.post('/events/:id/cancel', handle((req) => admin.cancelAdminEvent(me(req), id(req), String(body(req).reason ?? ''))))
router.delete('/events/:id', handle((req) => admin.deleteAdminEvent(me(req), id(req))))
router.post('/events/:id/categories', handle((req) => admin.addCategory(me(req), id(req), body(req)), 201))
router.put('/categories/:id', handle((req) => admin.updateCategory(me(req), id(req), body(req))))
router.delete('/categories/:id', handle((req) => admin.deleteCategory(me(req), id(req))))

// Orders and tickets
router.get('/orders', handle((req) => admin.listOrders(query(req))))
router.get('/orders/:id', handle((req) => admin.getOrder(id(req))))
router.post('/orders/:id/cancel', handle((req) => admin.cancelAdminOrder(me(req), id(req))))
router.get('/tickets', handle((req) => admin.listTickets(query(req))))
router.get('/tickets/:id', handle((req) => admin.getTicket(id(req))))
router.post('/tickets/:id/void', handle((req) => admin.voidTicket(me(req), id(req), String(body(req).reason ?? ''))))
router.post('/tickets/:id/resend', handle((req) => admin.resendAdminTicket(me(req), id(req))))

// Refunds: approving refunds the card on Stripe straight away; rejecting emails the customer the reason
router.get('/refunds', handle((req) => admin.listAdminRefunds(query(req))))
router.post('/refunds/:id/approve', handle(async (req) => { await admin.approveRefund(me(req), id(req)); return { message: 'Refund approved' } }))
router.post('/refunds/:id/reject', handle(async (req) => { await admin.rejectRefund(me(req), id(req), String(body(req).reason ?? '')); return { message: 'Refund rejected' } }))
router.post('/refunds/:id/settle', handle(async (req) => ({ status: await admin.settleRefund(me(req), id(req)) })))

// Users
router.get('/users', handle((req) => admin.listUsers(query(req))))
router.get('/users/:id', handle((req) => admin.getUser(id(req))))
router.post('/users/:id/block', handle((req) => admin.blockUser(me(req), id(req), String(body(req).reason ?? ''))))
router.post('/users/:id/unblock', handle((req) => admin.unblockUser(me(req), id(req))))
router.patch('/users/:id/role', handle((req) => admin.setUserRole(me(req), id(req), body(req).role)))

// Venues (with Google Maps links)
router.get('/venues', handle(() => admin.listAdminVenues()))
router.post('/venues/map-preview', handle((req) => admin.previewMapLink(body(req).url)))
router.post('/venues', handle((req) => admin.createVenue(me(req), body(req)), 201))
router.get('/venues/:id', handle((req) => admin.getAdminVenue(id(req))))
router.put('/venues/:id', handle((req) => admin.updateVenue(me(req), id(req), body(req))))
router.delete('/venues/:id', handle((req) => admin.deleteVenue(me(req), id(req))))

// Gate staff for the scanner app
router.get('/staff', handle(() => admin.listStaff()))
router.post('/staff', handle((req) => admin.createStaff(me(req), body(req)), 201))
router.post('/staff/:id/block', handle((req) => admin.setStaffBlocked(me(req), id(req), true)))
router.post('/staff/:id/unblock', handle((req) => admin.setStaffBlocked(me(req), id(req), false)))
router.post('/staff/:id/assignments', handle((req) => admin.assignStaff(me(req), id(req), String(body(req).eventId ?? ''))))
router.delete('/staff/:id/assignments/:eventId', handle((req) => admin.unassignStaff(me(req), id(req), req.params['eventId'] as string)))

export default router
