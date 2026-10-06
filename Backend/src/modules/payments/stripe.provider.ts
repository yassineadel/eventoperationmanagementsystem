import Stripe from 'stripe'
import { CreatePaymentInput, PaymentOutcome, PaymentProvider, PaymentSession } from './payment.port'

// Stripe adapter (FR-PAY-02). Uses PaymentIntents: the backend creates the intent, the frontend
// confirms it with Stripe Elements using the client secret, and Stripe tells us the result by
// webhook. Card details never touch our servers (FR-CHK-05, BR-17, NFR-14).

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const
  readonly testMode: boolean
  private stripe: Stripe

  constructor(secretKey: string, private webhookSecret: string) {
    this.stripe = new Stripe(secretKey)
    this.testMode = secretKey.startsWith('sk_test_')
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentSession> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountMinor,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        description: `Hafletna order ${input.reference}`,
        metadata: { orderId: input.orderId, reference: input.reference },
      },
      // Stripe-side guard: retrying for the same order can never create a second charge (FR-CHK-10)
      { idempotencyKey: `order-${input.orderId}` },
    )
    return { providerTxId: intent.id, clientSecret: intent.client_secret ?? undefined }
  }

  async resumePayment(providerTxId: string): Promise<PaymentSession> {
    const intent = await this.stripe.paymentIntents.retrieve(providerTxId)
    return { providerTxId, clientSecret: intent.client_secret ?? undefined }
  }

  async getStatus(providerTxId: string): Promise<PaymentOutcome> {
    const intent = await this.stripe.paymentIntents.retrieve(providerTxId)
    if (intent.status === 'succeeded') return 'SUCCEEDED'
    if (intent.status === 'canceled') return 'FAILED'
    // requires_payment_method after a decline is not final: the buyer may retry with another card
    return 'PENDING'
  }

  async cancel(providerTxId: string) {
    try {
      await this.stripe.paymentIntents.cancel(providerTxId)
    } catch {
      // already succeeded or cancelled — the caller re-checks the status
    }
  }

  async refund(providerTxId: string, opts: { amountMinor?: number; idempotencyKey: string }) {
    await this.stripe.refunds.create(
      { payment_intent: providerTxId, ...(opts.amountMinor !== undefined ? { amount: opts.amountMinor } : {}) },
      { idempotencyKey: opts.idempotencyKey },
    )
  }

  /**
   * Verifies a webhook really came from Stripe and extracts what we need.
   * Only success is final; a failed attempt leaves the intent open for another card.
   */
  parseWebhook(rawBody: Buffer, signature: string): { providerTxId: string; outcome: PaymentOutcome } | null {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
    if (event.type === 'payment_intent.succeeded') {
      return { providerTxId: (event.data.object as Stripe.PaymentIntent).id, outcome: 'SUCCEEDED' }
    }
    if (event.type === 'payment_intent.canceled') {
      return { providerTxId: (event.data.object as Stripe.PaymentIntent).id, outcome: 'FAILED' }
    }
    return null
  }
}
