// Figures for the analytics dashboard, worked out from the rows in lib/analyticsApi.ts.
// Pure functions, so tests/admin.test.mjs can check them without a browser.
import type { Category } from '../Homepage/types'
import { addDays, daysFrom, type AnalyticsData, type AnalyticsEvent, type RefundReasonKind } from '../../lib/analyticsApi.ts'

/** Inclusive date range, "YYYY-MM-DD". */
export type DateRange = { from: string; to: string }

export type RangePreset = '7' | '30' | '90' | 'all'

/** The first day with any sale, or `asOf` when there are none. */
export function firstDay(data: AnalyticsData) {
  return data.sales.reduce((min, s) => (s.date < min ? s.date : min), data.asOf)
}

export function presetRange(preset: RangePreset, data: AnalyticsData): DateRange {
  return preset === 'all' ? { from: firstDay(data), to: data.asOf } : { from: addDays(data.asOf, -(Number(preset) - 1)), to: data.asOf }
}

const within = (date: string, r: DateRange) => date >= r.from && date <= r.to

/**
 * Money in a range (FR-ADM-24, 25, 32). Customers paid ticket value + fees. Refunds take back
 * ticket value (the event owner's side) and, unless the customer asked, the fee too (the
 * platform's side). Platform net revenue = fees kept; owed to owners = ticket value kept.
 */
export function summary(data: AnalyticsData, r: DateRange) {
  const sales = data.sales.filter((s) => within(s.date, r))
  const refunds = data.refunds.filter((x) => within(x.date, r))
  const tickets = sales.reduce((n, s) => n + s.tickets, 0)
  const ticketValue = sales.reduce((n, s) => n + s.tickets * s.price, 0)
  const fees = ticketValue * data.serviceFee
  const refundedValue = refunds.reduce((n, x) => n + x.ticketValue, 0)
  const refundedFees = refunds.reduce((n, x) => n + x.feeRefunded, 0)
  return {
    tickets,
    ticketValue,
    fees,
    transacted: ticketValue + fees,
    refunds: refunds.reduce((n, x) => n + x.tickets, 0),
    refundedValue,
    refundedFees,
    refundTotal: refundedValue + refundedFees,
    platformNet: fees - refundedFees,
    ownersDue: ticketValue - refundedValue,
    transfers: data.transfers.filter((x) => within(x.date, r)).reduce((n, x) => n + x.tickets, 0),
  }
}

export type Summary = ReturnType<typeof summary>

/** Refunds in the range by why they happened. */
export function refundsByReason(data: AnalyticsData, r: DateRange) {
  const out: Record<RefundReasonKind, { tickets: number; amount: number }> = {
    customer: { tickets: 0, amount: 0 },
    admin: { tickets: 0, amount: 0 },
    eventCancelled: { tickets: 0, amount: 0 },
  }
  for (const x of data.refunds) {
    if (!within(x.date, r)) continue
    out[x.reason].tickets += x.tickets
    out[x.reason].amount += x.ticketValue + x.feeRefunded
  }
  return out
}

/**
 * Per-event performance and revenue split (FR-ADM-26, 27). `sold` / `capacity` are the event's
 * totals today; the money and counts are for the range. `perDay` is the average over the last
 * 7 days of the range: how fast it is selling now.
 */
export function perEvent(data: AnalyticsData, r: DateRange) {
  const recent: DateRange = { from: [addDays(r.to, -6), r.from].sort().reverse()[0], to: r.to }
  const recentDays = daysFrom(recent.from, recent.to) + 1
  return data.events
    .map((event) => {
      const own = <T extends { eventId: string; date: string }>(rows: T[], range = r) => rows.filter((x) => x.eventId === event.id && within(x.date, range))
      const s = summary({ ...data, sales: own(data.sales), refunds: own(data.refunds), transfers: own(data.transfers) }, r)
      const recentTickets = own(data.sales, recent).reduce((n, x) => n + x.tickets, 0)
      return { event, ...s, perDay: recentTickets / recentDays }
    })
    .filter((row) => row.tickets > 0 || row.refunds > 0 || row.transfers > 0)
    .sort((a, b) => b.ticketValue - a.ticketValue)
}

export type EventRow = ReturnType<typeof perEvent>[number]

/** Tickets and ticket value per day, every day of the range, optionally for one event (FR-ADM-27). */
export function daily(data: AnalyticsData, r: DateRange, eventId?: string) {
  const days = Array.from({ length: daysFrom(r.from, r.to) + 1 }, (_, i) => addDays(r.from, i))
  const byDay = new Map(days.map((d) => [d, { date: d, tickets: 0, value: 0 }]))
  for (const s of data.sales) {
    if (eventId && s.eventId !== eventId) continue
    const day = byDay.get(s.date)
    if (!day) continue
    day.tickets += s.tickets
    day.value += s.tickets * s.price
  }
  return days.map((d) => byDay.get(d)!)
}

/** Event categories by tickets and by ticket value in the range, strongest first (FR-ADM-28). */
export function byCategory(data: AnalyticsData, r: DateRange) {
  const eventCat = new Map(data.events.map((e) => [e.id, e.category]))
  const out = new Map<Category, { category: Category; tickets: number; value: number; events: Set<string> }>()
  for (const s of data.sales) {
    if (!within(s.date, r)) continue
    const category = eventCat.get(s.eventId)
    if (!category) continue
    const row = out.get(category) ?? { category, tickets: 0, value: 0, events: new Set<string>() }
    row.tickets += s.tickets
    row.value += s.tickets * s.price
    row.events.add(s.eventId)
    out.set(category, row)
  }
  return [...out.values()].map((c) => ({ category: c.category, tickets: c.tickets, value: c.value, events: c.events.size }))
}

/** Gate attendance for events that have started (FR-ADM-31). */
export function attendance(data: AnalyticsData) {
  return data.attendance
    .map((a) => ({ ...a, event: data.events.find((e) => e.id === a.eventId) as AnalyticsEvent, rate: a.sold ? a.admitted / a.sold : 0 }))
    .filter((a) => a.event)
    .sort((a, b) => b.event.startAt.localeCompare(a.event.startAt))
}
