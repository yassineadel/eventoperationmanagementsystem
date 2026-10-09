import { Request, Response } from 'express'
import { TicketError, getMyTicket, getMyTickets, getTransferChain, resendTicket, transferTicket } from './tickets.service'
import {
  approveRefund, getMyRefunds, getRefundQuote, listRefunds, rejectRefund, requestRefund, settleRefund,
} from './refunds.service'
import { isBadId } from '../../utils/badId'

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const result = await fn(req)
    res.status(okStatus).json(result ?? { message: 'Done' })
  } catch (error) {
    if (error instanceof TicketError) {
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

const id = (req: Request) => req.params['id'] as string

// ─── Ticket holder ──────────────────────────────────────────────────────────

/** GET /api/tickets */
export const myTickets = handle((req) => getMyTickets(req.user!.id))

/** GET /api/tickets/:id */
export const myTicket = handle((req) => getMyTicket(req.user!.id, id(req)))

/** POST /api/tickets/:id/resend */
export const resend = handle(async (req) => {
  await resendTicket(req.user!.id, id(req))
  return { message: 'Your ticket is on its way to your email' }
})

/** POST /api/tickets/:id/transfer { email } */
export const transfer = handle((req) => transferTicket(req.user!.id, id(req), req.body?.email))

/** GET /api/tickets/:id/refund-quote */
export const refundQuote = handle((req) => getRefundQuote(req.user!.id, id(req)))

/** POST /api/tickets/:id/refund { reason? } */
export const refund = handle((req) => requestRefund(req.user!.id, id(req), req.body?.reason), 201)

/** GET /api/refunds */
export const myRefunds = handle((req) => getMyRefunds(req.user!.id))

// ─── Administrator ──────────────────────────────────────────────────────────

const STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'SETTLED'] as const

/** GET /api/refunds/admin?status=SUBMITTED */
export const refundQueue = handle(async (req) => {
  const status = req.query['status']
  if (status !== undefined && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new TicketError(`status must be one of: ${STATUSES.join(', ')}`)
  }
  return listRefunds(status as (typeof STATUSES)[number] | undefined)
})

/** POST /api/refunds/:id/approve */
export const approve = handle(async (req) => {
  await approveRefund(req.user!.id, id(req))
  return { message: 'Refund approved' }
})

/** POST /api/refunds/:id/settle - retry sending the money if the provider was unavailable */
export const settle = handle(async (req) => ({ status: await settleRefund(req.user!.id, id(req)) }))

/** POST /api/refunds/:id/reject { reason } */
export const reject = handle(async (req) => {
  await rejectRefund(req.user!.id, id(req), req.body?.reason)
  return { message: 'Refund rejected' }
})

/** GET /api/tickets/:id/transfers */
export const transferChain = handle((req) => getTransferChain(id(req)))
