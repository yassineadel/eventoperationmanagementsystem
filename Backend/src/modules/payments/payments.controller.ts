import { Request, Response } from 'express'
import prisma from '../../config/db'
import { env } from '../../config/env'
import { getPaymentConfig, getPaymentProvider, handlePaymentResult } from './payments.service'
import { SimulatedOutcome, SimulatorProvider } from './simulator.provider'
import { StripeProvider } from './stripe.provider'

/**
 * Which provider is active and whether it is test mode (FR-PAY-07) — public
 * GET /api/payments/config
 */
export const config = (req: Request, res: Response) => {
  res.status(200).json(getPaymentConfig())
}

/**
 * Stripe tells us a payment's result. The body must be the raw bytes so the signature can be checked.
 * POST /api/payments/stripe/webhook
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  const p = getPaymentProvider()
  if (!(p instanceof StripeProvider)) {
    res.status(404).json({ message: 'Stripe is not enabled' })
    return
  }
  let parsed
  try {
    parsed = p.parseWebhook(req.body as Buffer, req.headers['stripe-signature'] as string)
  } catch {
    res.status(400).json({ message: 'Invalid signature' })
    return
  }
  try {
    if (parsed) await handlePaymentResult(parsed.providerTxId, parsed.outcome)
    res.status(200).json({ received: true })
  } catch (error) {
    console.error('Stripe webhook failed:', error)
    res.status(500).json({ message: 'Will be retried' }) // Stripe retries; reconciliation is the backstop
  }
}

const OUTCOMES: SimulatedOutcome[] = ['success', 'decline', 'timeout', 'success_lost', 'success_twice']

/**
 * Development only: play out a simulated payment for one of your own orders (FR-PAY-03)
 * POST /api/payments/simulator/:providerTxId { outcome }
 */
export const simulate = async (req: Request, res: Response) => {
  const p = getPaymentProvider()
  if (!(p instanceof SimulatorProvider) || env.NODE_ENV === 'production') {
    res.status(404).json({ message: 'The payment simulator is not enabled' })
    return
  }
  const providerTxId = req.params['providerTxId'] as string
  const outcome = req.body?.outcome as SimulatedOutcome
  if (!OUTCOMES.includes(outcome)) {
    res.status(400).json({ message: `outcome must be one of: ${OUTCOMES.join(', ')}` })
    return
  }
  const payment = await prisma.payment.findUnique({ where: { providerTxId }, select: { order: { select: { userId: true } } } })
  if (!payment || payment.order.userId !== req.user!.id) {
    res.status(404).json({ message: 'Payment not found' })
    return
  }
  try {
    await p.simulate(providerTxId, outcome)
    res.status(200).json({ message: `Simulated ${outcome}` })
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
  }
}
