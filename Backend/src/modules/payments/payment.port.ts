// The payment port (FR-PAY-01). Checkout and fulfilment only ever talk to this interface, so the
// provider (local simulator, Stripe, or a local gateway later) can be swapped by configuration.

export type PaymentOutcome = 'SUCCEEDED' | 'FAILED' | 'PENDING'

export interface CreatePaymentInput {
  orderId: string
  reference: string
  /** in the smallest currency unit, e.g. piastres for EGP */
  amountMinor: number
  currency: string
}

/** What the frontend needs to let the buyer pay */
export interface PaymentSession {
  providerTxId: string
  /** Stripe: passed to Stripe Elements on the frontend */
  clientSecret?: string
}

export interface PaymentProvider {
  readonly name: 'simulator' | 'stripe'
  /** true when no real money can move — drives the admin test-mode banner (FR-PAY-07) */
  readonly testMode: boolean
  createPayment(input: CreatePaymentInput): Promise<PaymentSession>
  /** Same session again, e.g. when the buyer retries checkout with the same idempotency key */
  resumePayment(providerTxId: string): Promise<PaymentSession>
  /** Asks the provider directly — used by reconciliation when a confirmation never arrived (FR-PAY-05) */
  getStatus(providerTxId: string): Promise<PaymentOutcome>
  /** Best effort: stop a payment that has not completed */
  cancel(providerTxId: string): Promise<void>
  /** Give back a payment that succeeded but cannot be honoured */
  refund(providerTxId: string): Promise<void>
}
