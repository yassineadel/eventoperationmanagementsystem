// Sales history for the admin analytics dashboard (FR-ADM-24 to FR-ADM-33).
//
// The dashboard needs every sale, refund and transfer with its date. Until the API serves
// them, this module builds that history from the sample events: each ticket category's sold
// count (adminEventsApi) is spread over the days its sales were open, wave by wave, so the
// totals here always match the event pages. Refunds come from the sample orders plus the
// cancelled Red Sea run; gate attendance is sampled for events that have started. The
// numbers are worked out in the browser (Components/Admin/analytics.ts), so when the API
// exists only `analyticsApi.load()` changes: it would return the same rows from the server.

import type { Category } from '../Components/Homepage/types'
import { adminEventsApi, type EventStatus } from './adminEventsApi.ts'
import { now } from './adminTime.ts'
import { EVENTS, ordersApi, SERVICE_FEE, ticketsApi } from './ordersApi.ts'

/** One day of sales for one wave: `tickets` sold at `price` each. Dates are "YYYY-MM-DD" (Cairo). */
export type SaleRow = { date: string; eventId: string; ticketCategory: string; wave: string; price: number; tickets: number }

export type RefundReasonKind = 'customer' | 'eventCancelled' | 'admin'

/** Money that went back: ticket value to the event owner's side, fee to the platform's. */
export type RefundRow = { date: string; eventId: string; tickets: number; ticketValue: number; feeRefunded: number; reason: RefundReasonKind }

export type TransferRow = { date: string; eventId: string; tickets: number }

/** Gate scans for an event that has started: tickets sold and people admitted (FR-ADM-31). */
export type AttendanceRow = { eventId: string; sold: number; admitted: number }

export type AnalyticsEvent = {
  id: string
  name: string
  category: Category
  status: EventStatus
  venueId: string
  venue: string
  startAt: string
  isPast: boolean
  /** Places on sale and tickets sold now, over every ticket category. */
  capacity: number
  sold: number
}

export type AnalyticsData = {
  /** The day the figures run up to. */
  asOf: string
  serviceFee: number
  events: AnalyticsEvent[]
  sales: SaleRow[]
  refunds: RefundRow[]
  transfers: TransferRow[]
  attendance: AttendanceRow[]
}

/* ----------------------------------------------------------- date helpers */

const DAY = 86_400_000

export const dayOf = (wall: string) => wall.slice(0, 10)

export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
export function daysFrom(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)
}

/* ------------------------------------------------------------ sample data */

/** How an event's sales were spread: most at the start, building towards the date, or even. */
type Curve = 'early' | 'late' | 'steady'

const CURVES: Record<string, Curve> = {
  '4f2a9c1e-7b3d-4e8a-9c21-5d6e7f8a9b01': 'late', // Cairo Jazz Night
  '8b3c0d2f-1a4e-4b9c-8d32-6e7f8a9b0c12': 'late', // Sunset Beats
  'c5d1e3a0-2b5f-4c0d-9e43-7f8a9b0c1d23': 'steady', // Stand-Up Friday
  'd6e2f4b1-3c6a-4d1e-8f54-8a9b0c1d2e34': 'early', // Acoustic Nights
  'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45': 'early', // Red Sea Beach Run
}

/** The Red Sea run sold these before it was cancelled and refunded; its categories now show 0 sold. */
const SOLD_BEFORE_CANCEL: Record<string, Record<string, number>> = {
  'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45': { PIT: 180, GA: 420 },
}

/** A small seeded random generator, so the history is the same on every load. */
function seeded(text: string) {
  let s = 2166136261
  for (let i = 0; i < text.length; i++) s = Math.imul(s ^ text.charCodeAt(i), 16777619)
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s / 2 ** 32
  }
}

function weights(days: string[], curve: Curve, rand: () => number) {
  const n = days.length
  return days.map((day, i) => {
    const x = n > 1 ? i / (n - 1) : 1
    const base = curve === 'early' ? Math.exp(-x * 3) + 0.12 : curve === 'late' ? 0.25 + x * x * 2.6 : 1
    const weekend = [4, 5].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) ? 1.35 : 1 // Thursday and Friday nights
    return base * weekend * (0.7 + rand() * 0.6)
  })
}

/** Splits `total` into whole numbers that follow the weights and add up exactly. */
function spread(total: number, w: number[]) {
  const sum = w.reduce((a, b) => a + b, 0) || 1
  const raw = w.map((x) => (x / sum) * total)
  const out = raw.map(Math.floor)
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])
  const missing = total - out.reduce((a, b) => a + b, 0)
  for (let k = 0; k < missing; k++) out[order[k % order.length][1]] += 1
  return out
}

async function build(): Promise<AnalyticsData> {
  const asOf = dayOf(now())
  const [details, orders, tickets] = await Promise.all([adminEventsApi.listWithCategories(), ordersApi.list(), ticketsApi.list()])
  const sales: SaleRow[] = []
  const refunds: RefundRow[] = []
  const transfers: TransferRow[] = []
  const attendance: AttendanceRow[] = []

  for (const { event, categories } of details) {
    if (event.status === 'draft') continue
    const opened = dayOf(event.salesOpenAt ?? event.publishedAt ?? event.createdAt)
    const closesAt = event.cancelledAt ?? event.salesCloseAt ?? event.startAt
    const last = [asOf, dayOf(closesAt)].sort()[0]
    if (last < opened) continue
    const days = Array.from({ length: daysFrom(opened, last) + 1 }, (_, i) => addDays(opened, i))
    const rand = seeded(event.id)
    const w = weights(days, CURVES[event.id] ?? 'steady', rand)
    const before = SOLD_BEFORE_CANCEL[event.id]

    for (const c of categories) {
      const sold = before?.[c.key] ?? c.sold
      if (!sold) continue
      // Waves sell in order, so the first wave's tickets are the first days' tickets.
      const perDay = spread(sold, w)
      const waves = before ? [{ name: c.waves[0]?.name ?? 'Regular', price: c.waves[0]?.price ?? c.price, sold }] : c.waves
      let wave = 0
      let left = waves[0]?.sold ?? 0
      perDay.forEach((count, i) => {
        while (count > 0 && wave < waves.length) {
          if (left === 0) {
            wave += 1
            left = waves[wave]?.sold ?? 0
            continue
          }
          const take = Math.min(count, left)
          sales.push({ date: days[i], eventId: event.id, ticketCategory: c.name, wave: waves[wave].name, price: waves[wave].price, tickets: take })
          count -= take
          left -= take
        }
      })
    }

    // A few buyers hand tickets on to friends a few days after buying.
    const rate = 0.02 + rand() * 0.03
    for (const day of days) {
      const bought = sales.filter((s) => s.eventId === event.id && s.date === day).reduce((n, s) => n + s.tickets, 0)
      const count = Math.floor(bought * rate + rand())
      const on = addDays(day, 1 + Math.floor(rand() * 5))
      if (count > 0 && on <= asOf && on <= dayOf(event.startAt)) transfers.push({ date: on, eventId: event.id, tickets: count })
    }

    if (before) {
      // Cancelled: every ticket refunded in full, fee included (FR-ADM-14).
      const value = categories.reduce((n, c) => n + (before[c.key] ?? 0) * (c.waves[0]?.price ?? c.price), 0)
      const count = Object.values(before).reduce((n, x) => n + x, 0)
      refunds.push({ date: dayOf(event.cancelledAt ?? closesAt), eventId: event.id, tickets: count, ticketValue: value, feeRefunded: value * SERVICE_FEE, reason: 'eventCancelled' })
    }

    if (event.status === 'published' && event.isPast && event.sold > 0) {
      attendance.push({ eventId: event.id, sold: event.sold, admitted: Math.round(event.sold * (0.86 + rand() * 0.09)) })
    }
  }

  // Refunds recorded on orders (customer requests and admin refunds).
  for (const o of orders) {
    const amount = o.payment.refundAmount
    if (!amount || !o.payment.refundedAt || o.reason?.key === 'eventCancelled') continue
    // Customer requests keep the fee; refunds by the team (other reasons, blocked holders) return it.
    const eventId = EVENTS[o.eventKey]?.eventId
    if (!eventId) continue
    const count = tickets.filter((t) => t.orderId === o.id && t.status === 'cancelled').length || o.qty
    const feeKept = o.reason?.key === 'customer'
    const ticketValue = feeKept ? amount : Math.round(amount / (1 + SERVICE_FEE))
    refunds.push({ date: dayOf(o.payment.refundedAt), eventId, tickets: count, ticketValue, feeRefunded: amount - ticketValue, reason: feeKept ? 'customer' : 'admin' })
  }

  return {
    asOf,
    serviceFee: SERVICE_FEE,
    events: details.map(({ event }) => ({
      id: event.id,
      name: event.name,
      category: event.category,
      status: event.status,
      venueId: event.venueId,
      venue: event.venue,
      startAt: event.startAt,
      isPast: event.isPast,
      capacity: event.capacity,
      sold: event.sold,
    })),
    sales,
    refunds,
    transfers,
    attendance,
  }
}

export const analyticsApi = {
  async load(): Promise<AnalyticsData> {
    return build()
  },
}
