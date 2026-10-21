import prisma from '../../config/db'
import { env } from '../../config/env'
import { convertOrderHolds, releaseOrderHolds } from '../inventory/inventory.service'
import { issueTicketsForOrder } from '../tickets/tickets.service'
import { PaymentOutcome, PaymentProvider } from './payment.port'
import { SimulatorProvider } from './simulator.provider'
import { StripeProvider } from './stripe.provider'
import { guardTx } from '../../utils/guardTx'
import { sendOrderTicketEmails } from '../tickets/ticket-mail'

// Payment results move an order to its final state. Every transition is a conditional update on
// the order's status, so a result can arrive twice, late, or in parallel with the cleanup worker
// and the order still ends up in exactly one state with tickets issued at most once.

let provider: PaymentProvider | null = null

export const getPaymentProvider = (): PaymentProvider => {
  if (!provider) {
    provider =
      env.PAYMENT_PROVIDER === 'stripe'
        ? new StripeProvider(env.STRIPE_SECRET_KEY!, env.STRIPE_WEBHOOK_SECRET!)
        : new SimulatorProvider((txId, outcome) => handlePaymentResult(txId, outcome))
  }
  return provider
}

/** For the admin test-mode banner and the frontend's payment form (FR-PAY-07) */
export const getPaymentConfig = () => {
  const p = getPaymentProvider()
  return { provider: p.name, testMode: p.testMode }
}

/** Whole-currency amounts are stored as Decimal; providers want the smallest unit */
export const toMinorUnits = (amount: { toString(): string }) => Math.round(Number(amount.toString()) * 100)

/**
 * Starts a payment for a new order and records it (status PENDING)
 */
export const startPayment = async (order: { id: string; reference: string; total: { toString(): string }; currency: string }) => {
  const p = getPaymentProvider()
  const session = await p.createPayment({
    orderId: order.id,
    reference: order.reference,
    amountMinor: toMinorUnits(order.total),
    currency: order.currency,
  })
  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: p.name,
      providerTxId: session.providerTxId,
      amount: order.total.toString(),
      currency: order.currency,
    },
  })
  return session
}

/**
 * Entry point for every payment result: provider webhook, simulator, or reconciliation
 */
export const handlePaymentResult = async (providerTxId: string, outcome: PaymentOutcome) => {
  const payment = await prisma.payment.findUnique({ where: { providerTxId }, select: { orderId: true } })
  if (!payment) return
  if (outcome === 'SUCCEEDED') await fulfilOrder(payment.orderId)
  else if (outcome === 'FAILED') await failOrder(payment.orderId)
}

/**
 * Payment succeeded: order PAID, holds become sold, tickets issued — all or nothing.
 */
export const fulfilOrder = async (orderId: string): Promise<'PAID' | 'ALREADY_PAID' | 'REFUNDED'> => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await guardTx(tx)
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      })
      if (count === 0) {
        const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })
        return order.status === 'PAID' ? ('ALREADY_PAID' as const) : ('LATE' as const)
      }
      await tx.payment.update({ where: { orderId }, data: { status: 'SUCCEEDED', paidAt: new Date() } })
      await convertOrderHolds(tx, orderId)
      await issueTicketsForOrder(tx, orderId)
      return 'PAID' as const
    }, { maxWait: 20_000, timeout: 20_000 })

    if (result === 'PAID') {
      // tickets are issued; email them without making the payment wait for Gmail
      sendOrderTicketEmails(orderId).catch((e) => console.error(`Ticket emails for order ${orderId} failed:`, e))
    }
    if (result !== 'LATE') return result
  } catch (e) {
    // The holds expired while paying and the places were sold to someone else (HF_SOLD_OUT), or a
    // seat was taken (unique violation). The money cannot be honoured: fail the order and refund.
    const text = e instanceof Error ? e.message : String(e)
    if (!text.includes('HF_SOLD_OUT') && !text.includes('uidx_tickets_event_seat_live') && !text.includes('23505')) throw e
    await prisma.$transaction(async (tx) => {
      await guardTx(tx)
      await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'FAILED' } })
      await releaseOrderHolds(tx, orderId)
    })
  }

  // Paid after the order was already cancelled or failed: give the money back (FR-PAY-05)
  await refundOrderPayment(orderId)
  return 'REFUNDED'
}

const refundOrderPayment = async (orderId: string) => {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } })
  if (payment.status === 'REFUNDED' || !payment.providerTxId) return
  await getPaymentProvider().refund(payment.providerTxId, { idempotencyKey: `order-refund-${orderId}` })
  await prisma.payment.update({ where: { orderId }, data: { status: 'REFUNDED' } })
  console.warn(`Order ${orderId}: payment succeeded after the order closed, refunded automatically`)
}

/**
 * Payment failed: no tickets, places released, the buyer can start again (FR-CHK-09, FR-PAY-04)
 */
export const failOrder = async (orderId: string, status: 'FAILED' | 'CANCELLED' = 'FAILED') => {
  return prisma.$transaction(async (tx) => {
    await guardTx(tx)
    const { count } = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status } })
    if (count === 0) return false
    await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'FAILED' } })
    await releaseOrderHolds(tx, orderId)
    return true
  })
}

/**
 * The cleanup worker's job:
 * - orders past their payment deadline: ask the provider first, so a payment that succeeded but
 *   whose confirmation was lost is honoured rather than cancelled (FR-PAY-05, NFR-09);
 *   otherwise cancel the payment and release the places (FR-CHK-09)
 * - orders still waiting after a couple of minutes: ask the provider whether they actually paid
 */
export const reconcilePayments = async () => {
  const p = getPaymentProvider()
  const now = new Date()
  const waiting = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - 2 * 60_000) } },
    select: { id: true, expiresAt: true, payment: { select: { providerTxId: true } } },
    take: 100,
  })

  let paid = 0
  let cancelled = 0
  for (const o of waiting) {
    const txId = o.payment?.providerTxId
    const status = txId ? await p.getStatus(txId) : 'FAILED'
    if (status === 'SUCCEEDED') {
      if ((await fulfilOrder(o.id)) === 'PAID') paid++
    } else if (o.expiresAt && o.expiresAt <= now) {
      if (txId) await p.cancel(txId)
      // cancelling can race with a last-second success, so check once more
      if (txId && (await p.getStatus(txId)) === 'SUCCEEDED') {
        if ((await fulfilOrder(o.id)) === 'PAID') paid++
      } else if (await failOrder(o.id, 'CANCELLED')) {
        cancelled++
      }
    }
  }
  return { paid, cancelled }
}

export const startPaymentWorker = (intervalMs = 30_000) => {
  let running = false
  const timer = setInterval(() => {
    // a slow run must finish before the next starts, or runs pile up and use every connection
    if (running) return
    running = true
    reconcilePayments()
      .catch((e) => console.error('Payment reconciliation failed:', e))
      .finally(() => { running = false })
  }, intervalMs)
  timer.unref()
  return timer
}
