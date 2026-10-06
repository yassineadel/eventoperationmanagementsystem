import crypto from 'crypto'
import { CreatePaymentInput, PaymentOutcome, PaymentProvider, PaymentSession } from './payment.port'

// Local payment simulator (FR-PAY-03). Produces every outcome on demand, so checkout can be built
// and demonstrated without any gateway account. State lives in memory: restart the server and
// in-flight simulated payments are gone, which is fine for development and testing.

export type SimulatedOutcome =
  | 'success' // pays and confirms
  | 'decline' // card declined
  | 'timeout' // the buyer never finishes; the order is cancelled at its deadline
  | 'success_lost' // pays, but the confirmation never reaches us — reconciliation must find it (FR-PAY-05)
  | 'success_twice' // pays and the confirmation arrives twice — must not issue tickets twice (FR-CHK-10)

type Notify = (providerTxId: string, outcome: PaymentOutcome) => Promise<void>

interface SimPayment {
  amountMinor: number
  refundedMinor: number
  status: PaymentOutcome | 'CANCELLED' | 'REFUNDED'
}

export class SimulatorProvider implements PaymentProvider {
  readonly name = 'simulator' as const
  readonly testMode = true
  private payments = new Map<string, SimPayment>()

  constructor(private notify: Notify) {}

  async createPayment(input: CreatePaymentInput): Promise<PaymentSession> {
    const providerTxId = `sim_${crypto.randomUUID()}`
    this.payments.set(providerTxId, { amountMinor: input.amountMinor, refundedMinor: 0, status: 'PENDING' })
    return { providerTxId }
  }

  async resumePayment(providerTxId: string): Promise<PaymentSession> {
    return { providerTxId }
  }

  async getStatus(providerTxId: string): Promise<PaymentOutcome> {
    const p = this.payments.get(providerTxId)
    if (!p) return 'FAILED'
    return p.status === 'SUCCEEDED' || p.status === 'REFUNDED' ? 'SUCCEEDED' : p.status === 'PENDING' ? 'PENDING' : 'FAILED'
  }

  async cancel(providerTxId: string) {
    const p = this.payments.get(providerTxId)
    if (p && p.status === 'PENDING') p.status = 'CANCELLED'
  }

  private refundKeys = new Set<string>()

  async refund(providerTxId: string, opts: { amountMinor?: number; idempotencyKey: string }) {
    const p = this.payments.get(providerTxId)
    if (!p) throw new Error('Unknown simulated payment')
    if (this.refundKeys.has(opts.idempotencyKey)) return // same refund retried: pay out once
    const amount = opts.amountMinor ?? p.amountMinor - p.refundedMinor
    if (p.refundedMinor + amount > p.amountMinor) throw new Error('Refund exceeds the amount paid')
    this.refundKeys.add(opts.idempotencyKey)
    p.refundedMinor += amount
    if (p.refundedMinor === p.amountMinor) p.status = 'REFUNDED'
  }

  /** Plays out what the buyer and the "bank" do. Called from the dev-only simulator endpoint. */
  async simulate(providerTxId: string, outcome: SimulatedOutcome) {
    const p = this.payments.get(providerTxId)
    if (!p) throw new Error('Unknown simulated payment')
    if (p.status !== 'PENDING') throw new Error(`This payment is already ${p.status.toLowerCase()}`)

    switch (outcome) {
      case 'success':
        p.status = 'SUCCEEDED'
        await this.notify(providerTxId, 'SUCCEEDED')
        break
      case 'success_twice':
        p.status = 'SUCCEEDED'
        await Promise.all([this.notify(providerTxId, 'SUCCEEDED'), this.notify(providerTxId, 'SUCCEEDED')])
        break
      case 'success_lost':
        p.status = 'SUCCEEDED' // charged, but nobody is told
        break
      case 'decline':
        p.status = 'FAILED'
        await this.notify(providerTxId, 'FAILED')
        break
      case 'timeout':
        break // stays pending until the order deadline passes
    }
  }
}
