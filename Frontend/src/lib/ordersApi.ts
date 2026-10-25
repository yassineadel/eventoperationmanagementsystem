// Orders, tickets and refund requests for the admin console.
//
// The admin console runs on sample data until its endpoints are wired: eight orders
// across four events with their items, payment, tickets and, for refunded or cancelled
// orders, the reason, plus the customers' refund requests. Orders point at the sample
// admin events (adminEventsApi) and users (usersApi) by ID so the pages can link to each
// other. Refunds, reminders and decisions change the sample data in memory until the page
// reloads. When the API exists, replace the bodies of the `*Api` objects with calls from './api'.

import { adminEventsApi } from './adminEventsApi.ts'
import { AdminApiError } from './adminErrors.ts'
import { daysBetween, now } from './adminTime.ts'

export type OrderStatus = 'paid' | 'pending' | 'refunded' | 'cancelled'
export type TicketStatus = 'valid' | 'checked' | 'cancelled'
export type RefundReason = 'customer' | 'eventChanged' | 'duplicate' | 'other'
export type ReasonKey = RefundReason | 'paymentFailed' | 'eventCancelled'

/** Copy written by people (notes, who did it) comes in both languages. */
export type Localized = { en: string; ar: string }

export type EventInfo = {
  key: string
  /** The event's ID in the admin events list. */
  eventId: string
  name: string
  venue: string
  /** Venue ID when the venue has an admin page. */
  venueId?: string
  startsAt: string
}

export type OrderItem = { category: string; unitPrice: number; qty: number }

export type Payment = {
  /** Card label such as "Visa ·· 4242", or the Fawry reference for cash payments. */
  method: string
  fawry: boolean
  reference: string
  paidAt?: string
  dueBy?: string
  refundedAt?: string
  /** What was returned to the customer; the service fee is kept on customer refunds. */
  refundAmount?: number
  cancelledAt?: string
  declined?: boolean
}

export type OrderReason = { key: ReasonKey; note?: Localized; by: Localized; at: string }

export type Order = {
  id: string
  customer: { userId: string; name: string; email: string; phone: string }
  eventKey: string
  qty: number
  subtotal: number
  fee: number
  total: number
  status: OrderStatus
  placedAt: string
  items: OrderItem[]
  payment: Payment
  reason?: OrderReason
}

export type Ticket = {
  code: string
  orderId: string
  holder: string
  eventKey: string
  category: string
  seat: string
  status: TicketStatus
  /** Gate scans; the first one is the check-in. */
  scans: string[]
}

export type OrderDetail = { order: Order; event: EventInfo; tickets: Ticket[] }
export type TicketDetail = { ticket: Ticket; event: EventInfo; order: Order }

export type RefundRequestStatus = 'submitted' | 'approved' | 'rejected'

/** A customer's request to refund one ticket (FR-MTK-04 to FR-MTK-09, FR-ADM-16). */
export type RefundRequest = {
  id: string
  ticketCode: string
  requestedAt: string
  note: Localized
  status: RefundRequestStatus
  decidedAt?: string
  decidedBy?: string
  rejectReason?: Localized
}

export type RefundRequestRow = RefundRequest & {
  ticket: Ticket
  order: Order
  event: EventInfo
  /** The ticket price; the service fee is kept on customer refunds (BR-04 to BR-06). */
  amount: number
  fee: number
  daysBefore: number
  /** Requested at least REFUND_CUTOFF_DAYS before the event. */
  eligible: boolean
}

/** Customers can ask for a refund until this many days before the event (FR-MTK-04). */
export const REFUND_CUTOFF_DAYS = 7
export const SERVICE_FEE = 0.03

/* ----------------------------------------------------------- sample data */

/** The events that have orders. Name, venue and start are refreshed from the admin events on every read. */
export const EVENTS: Record<string, EventInfo> = {
  jazz: { key: 'jazz', eventId: '4f2a9c1e-7b3d-4e8a-9c21-5d6e7f8a9b01', name: 'Cairo Jazz Night', venue: 'Nile Arena', venueId: '7c1e4b2a-91d3-4f0e-a6b5-2d8f3c9e1a07', startsAt: '2026-10-24T20:00' },
  sunset: { key: 'sunset', eventId: '8b3c0d2f-1a4e-4b9c-8d32-6e7f8a9b0c12', name: 'Sunset Beats', venue: 'Riverfront Stage', venueId: 'b84f0c6d-3e2a-47b9-8d15-6a0e9f4c2b31', startsAt: '2026-10-31T17:00' },
  standup: { key: 'standup', eventId: 'c5d1e3a0-2b5f-4c0d-9e43-7f8a9b0c1d23', name: 'Stand-Up Friday', venue: 'Downtown Hall', venueId: '3a9d7e15-c2f8-4b60-9e4a-81b5d0f6c7e2', startsAt: '2026-10-16T21:00' },
  acoustic: { key: 'acoustic', eventId: 'd6e2f4b1-3c6a-4d1e-8f54-8a9b0c1d2e34', name: 'Acoustic Nights', venue: 'Garden Amphitheater', venueId: 'e2c5a8f1-6b4d-4d7e-b0a3-9f1c8e2d5b46', startsAt: '2026-11-14T18:30' },
}

type OrderSeed = Omit<Order, 'qty' | 'subtotal' | 'fee' | 'total'>

const SEEDS: OrderSeed[] = [
  {
    id: 'HF-10241',
    customer: { userId: '3b8a6f2c-4d9e-4c0f-8a1b-2c3d4e5f6a72', name: 'Mariam Hassan', email: 'mariam.hassan@example.com', phone: '+20 100 123 4567' },
    eventKey: 'jazz',
    status: 'paid',
    placedAt: '2026-10-12T19:40',
    items: [
      { category: 'VIP', unitPrice: 1500, qty: 2 },
      { category: 'Premium', unitPrice: 900, qty: 1 },
    ],
    payment: { method: 'Visa ·· 4242', fawry: false, reference: 'PAY-8F3K2Q', paidAt: '2026-10-12T19:42' },
  },
  {
    id: 'HF-10240',
    customer: { userId: '4c9b7a3d-5e0f-4d1a-9b2c-3d4e5f6a7b83', name: 'Omar Khaled', email: 'omar.khaled@example.com', phone: '+20 111 482 9031' },
    eventKey: 'sunset',
    status: 'pending',
    placedAt: '2026-10-12T18:05',
    items: [{ category: 'General', unitPrice: 600, qty: 2 }],
    payment: { method: 'Fawry', fawry: true, reference: '7731 2290', dueBy: '2026-10-13T18:05' },
  },
  {
    id: 'HF-10239',
    customer: { userId: '5d0c8b4e-6f1a-4e2b-8c3d-4e5f6a7b8c94', name: 'Salma Adel', email: 'salma.adel@example.com', phone: '+20 122 905 1176' },
    eventKey: 'standup',
    status: 'paid',
    placedAt: '2026-10-11T22:14',
    items: [{ category: 'Standard', unitPrice: 400, qty: 4 }],
    payment: { method: 'Mastercard ·· 8810', fawry: false, reference: 'PAY-2M7D4R', paidAt: '2026-10-11T22:16' },
  },
  {
    id: 'HF-10238',
    customer: { userId: '6e1d9c5f-7a2b-4f3c-9d4e-5f6a7b8c9da5', name: 'Youssef Tarek', email: 'youssef.tarek@example.com', phone: '+20 101 377 6402' },
    eventKey: 'jazz',
    status: 'refunded',
    placedAt: '2026-10-11T16:30',
    items: [{ category: 'Premium', unitPrice: 900, qty: 1 }],
    payment: {
      method: 'Visa ·· 1187',
      fawry: false,
      reference: 'PAY-6T1X9C',
      paidAt: '2026-10-11T16:32',
      refundedAt: '2026-10-13T10:05',
      refundAmount: 900,
    },
    reason: {
      key: 'customer',
      note: {
        en: 'The customer can’t attend anymore because of a family emergency and asked for a refund.',
        ar: 'لم يعد بإمكان العميل الحضور بسبب ظرف عائلي طارئ وطلب استرداد المبلغ.',
      },
      by: { en: 'Nadine Farouk · Support', ar: 'نادين فاروق · الدعم' },
      at: '2026-10-13T10:05',
    },
  },
  {
    id: 'HF-10237',
    customer: { userId: '7f2e0d6a-8b3c-4a4d-8e5f-6a7b8c9d0eb6', name: 'Habiba Mostafa', email: 'habiba.mostafa@example.com', phone: '+20 155 640 2218' },
    eventKey: 'acoustic',
    status: 'paid',
    placedAt: '2026-10-10T13:52',
    items: [{ category: 'General', unitPrice: 400, qty: 2 }],
    payment: { method: 'Meeza ·· 3302', fawry: false, reference: 'PAY-4H8N1V', paidAt: '2026-10-10T13:54' },
  },
  {
    id: 'HF-10236',
    customer: { userId: '8a3f1e7b-9c4d-4b5e-9f6a-7b8c9d0e1fc7', name: 'Karim Fathy', email: 'karim.fathy@example.com', phone: '+20 128 214 7750' },
    eventKey: 'sunset',
    status: 'cancelled',
    placedAt: '2026-10-10T11:08',
    items: [{ category: 'General', unitPrice: 600, qty: 5 }],
    payment: { method: 'Card ·· 0094', fawry: false, reference: 'PAY-1Z5Q7K', declined: true, cancelledAt: '2026-10-10T11:38' },
    reason: {
      key: 'paymentFailed',
      note: {
        en: 'The bank declined the card, so the order was cancelled automatically after 30 minutes without payment.',
        ar: 'رفض البنك البطاقة، فأُلغي الطلب تلقائيًا بعد ٣٠ دقيقة دون دفع.',
      },
      by: { en: 'Hafletna · automatic', ar: 'حفلتنا · تلقائي' },
      at: '2026-10-10T11:38',
    },
  },
  {
    id: 'HF-10235',
    customer: { userId: '9b4a2f8c-0d5e-4c6f-8a7b-8c9d0e1f2ad8', name: 'Laila Samir', email: 'laila.samir@example.com', phone: '+20 106 831 5524' },
    eventKey: 'standup',
    status: 'paid',
    placedAt: '2026-10-09T21:47',
    items: [{ category: 'Standard', unitPrice: 400, qty: 2 }],
    payment: { method: 'Visa ·· 5521', fawry: false, reference: 'PAY-9L2W6B', paidAt: '2026-10-09T21:49' },
  },
  {
    id: 'HF-10234',
    customer: { userId: '0c5b3a9d-1e6f-4d7a-9b8c-9d0e1f2a3be9', name: 'Nour El-Din Ali', email: 'nour.ali@example.com', phone: '+20 114 270 6698' },
    eventKey: 'acoustic',
    status: 'pending',
    placedAt: '2026-10-09T17:20',
    items: [{ category: 'General', unitPrice: 400, qty: 3 }],
    payment: { method: 'Fawry', fawry: true, reference: '7731 4417', dueBy: '2026-10-10T17:20' },
  },
]

let ORDERS: Order[] = SEEDS.map((o) => {
  const subtotal = o.items.reduce((n, i) => n + i.unitPrice * i.qty, 0)
  const fee = Math.round(subtotal * SERVICE_FEE)
  return { ...o, qty: o.items.reduce((n, i) => n + i.qty, 0), subtotal, fee, total: subtotal + fee }
})

const ticket = (code: string, orderId: string, holder: string, eventKey: string, category: string, seat: string, status: TicketStatus, scans: string[] = []): Ticket => ({
  code,
  orderId,
  holder,
  eventKey,
  category,
  seat,
  status,
  scans,
})

let TICKETS: Ticket[] = [
  ticket('HFT-7Q2K-91', 'HF-10241', 'Mariam Hassan', 'jazz', 'VIP', 'Orchestra · A7', 'valid'),
  ticket('HFT-7Q2K-92', 'HF-10241', 'Mariam Hassan', 'jazz', 'VIP', 'Orchestra · A8', 'valid'),
  ticket('HFT-7Q2K-93', 'HF-10241', 'Mariam Hassan', 'jazz', 'Premium', 'Orchestra · D12', 'valid'),
  ticket('HFT-5M8D-41', 'HF-10239', 'Salma Adel', 'standup', 'Standard', 'Left wing · C3', 'checked', ['2026-10-16T20:41', '2026-10-16T20:44']),
  ticket('HFT-5M8D-42', 'HF-10239', 'Salma Adel', 'standup', 'Standard', 'Left wing · C4', 'checked', ['2026-10-16T20:41', '2026-10-16T20:44']),
  ticket('HFT-5M8D-43', 'HF-10239', 'Salma Adel', 'standup', 'Standard', 'Left wing · C5', 'checked', ['2026-10-16T20:43', '2026-10-16T20:46']),
  ticket('HFT-5M8D-44', 'HF-10239', 'Salma Adel', 'standup', 'Standard', 'Left wing · C6', 'valid'),
  ticket('HFT-3R6P-17', 'HF-10238', 'Youssef Tarek', 'jazz', 'Premium', 'Orchestra · E5', 'cancelled'),
  ticket('HFT-9C1L-08', 'HF-10237', 'Habiba Mostafa', 'acoustic', 'General', 'Zone · General', 'valid'),
  ticket('HFT-9C1L-09', 'HF-10237', 'Habiba Mostafa', 'acoustic', 'General', 'Zone · General', 'valid'),
  ticket('HFT-2W4N-55', 'HF-10235', 'Laila Samir', 'standup', 'Standard', 'Right wing · B2', 'checked', ['2026-10-16T20:52']),
  ticket('HFT-2W4N-56', 'HF-10235', 'Laila Samir', 'standup', 'Standard', 'Right wing · B3', 'checked', ['2026-10-16T20:52']),
]

let REQUESTS: RefundRequest[] = [
  {
    id: 'RR-2043',
    ticketCode: 'HFT-7Q2K-92',
    requestedAt: '2026-10-19T10:05',
    status: 'submitted',
    note: { en: 'My flight back to Cairo was moved to the 25th.', ar: 'تأجلت رحلة عودتي إلى القاهرة إلى يوم ٢٥.' },
  },
  {
    id: 'RR-2042',
    ticketCode: 'HFT-9C1L-09',
    requestedAt: '2026-10-18T20:10',
    status: 'submitted',
    note: { en: 'The friend I bought this ticket for can no longer come.', ar: 'الصديقة التي اشتريت لها التذكرة لم تعد تستطيع الحضور.' },
  },
  {
    id: 'RR-2041',
    ticketCode: 'HFT-7Q2K-93',
    requestedAt: '2026-10-15T09:30',
    status: 'submitted',
    note: { en: 'A work trip was moved to the same evening.', ar: 'تغيّر موعد رحلة عمل إلى المساء نفسه.' },
  },
  {
    id: 'RR-2039',
    ticketCode: 'HFT-5M8D-44',
    requestedAt: '2026-10-12T13:00',
    status: 'rejected',
    note: { en: 'One of us got sick.', ar: 'مرض أحدنا.' },
    decidedAt: '2026-10-12T16:20',
    decidedBy: 'Nadine Farouk',
    rejectReason: {
      en: 'Requested four days before the show; refunds close seven days before.',
      ar: 'قُدّم الطلب قبل العرض بأربعة أيام، وتُغلق الاستردادات قبل سبعة أيام.',
    },
  },
]

/* ------------------------------------------------------------------- api */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Reads each event's current name, venue and start, so a moved or renamed event shows the same everywhere. */
async function syncEvents() {
  const events = await adminEventsApi.list()
  for (const info of Object.values(EVENTS)) {
    const e = events.find((x) => x.id === info.eventId)
    if (e) Object.assign(info, { name: e.name, venue: e.venue, venueId: e.venueId, startsAt: e.startAt })
  }
}

/** Waits like the network would, and refreshes the event details meanwhile. */
const fetched = (ms: number) => Promise.all([delay(ms), syncEvents()])

export class OrderNotFoundError extends Error {
  constructor() {
    super('Not found')
    this.name = 'OrderNotFoundError'
  }
}

function findOrder(id: string) {
  const order = ORDERS.find((o) => o.id === id)
  if (!order) throw new OrderNotFoundError()
  return order
}

function detail(order: Order): OrderDetail {
  return { order, event: EVENTS[order.eventKey], tickets: TICKETS.filter((t) => t.orderId === order.id) }
}

/** Event key for an admin event ID, or undefined when that event has no orders. */
export function eventKeyFor(eventId: string) {
  return Object.values(EVENTS).find((e) => e.eventId === eventId)?.key
}

const priceOf = (order: Pick<Order, 'items'>, category: string) => order.items.find((i) => i.category === category)?.unitPrice ?? 0

/**
 * What a refund returns. It covers the tickets that still work: ones already refunded or
 * used at the gate are left out. When the customer asks, Hafletna keeps the service fee and
 * returns the ticket price (BR-04 to BR-06); when the event changed or it was our mistake,
 * the fee goes back too.
 */
export function refundQuote(order: Pick<Order, 'items' | 'fee'>, tickets: Pick<Ticket, 'category' | 'status'>[], reason: RefundReason) {
  const open = tickets.filter((t) => t.status === 'valid')
  const price = open.reduce((n, t) => n + priceOf(order, t.category), 0)
  const fee = open.length === tickets.length ? order.fee : Math.round(price * SERVICE_FEE)
  const feeKept = reason === 'customer'
  return { count: open.length, tickets: price, fee, feeKept, amount: feeKept ? price : price + fee }
}

/** A pending order whose payment time ran out. */
export const isOverdue = (o: Order, at = now()) => o.status === 'pending' && Boolean(o.payment.dueBy && o.payment.dueBy < at)

const ADMIN_BY = (name: string): Localized => ({ en: name, ar: name })

export const ordersApi = {
  async list(): Promise<Order[]> {
    await fetched(350)
    return ORDERS
  },
  async get(id: string): Promise<OrderDetail> {
    await fetched(300)
    return detail(findOrder(id))
  },
  /**
   * Refund the tickets on a paid order that still work; they stop working at the gate.
   * Open refund requests for those tickets are settled by this refund.
   */
  async refund(id: string, input: { reason: RefundReason; note: string }, actor = 'Admin'): Promise<OrderDetail> {
    await fetched(500)
    const order = findOrder(id)
    if (order.status !== 'paid') throw new AdminApiError('paid-only-refund')
    const own = TICKETS.filter((t) => t.orderId === id)
    const quote = refundQuote(order, own, input.reason)
    if (quote.count === 0) throw new AdminApiError('nothing-to-refund')
    const at = now()
    const note = input.note.trim()
    const refunded: Order = {
      ...order,
      status: 'refunded',
      payment: { ...order.payment, refundedAt: at, refundAmount: (order.payment.refundAmount ?? 0) + quote.amount },
      reason: { key: input.reason, note: note ? { en: note, ar: note } : undefined, by: ADMIN_BY(actor), at },
    }
    const voided = new Set(own.filter((t) => t.status === 'valid').map((t) => t.code))
    ORDERS = ORDERS.map((o) => (o.id === id ? refunded : o))
    TICKETS = TICKETS.map((t) => (voided.has(t.code) ? { ...t, status: 'cancelled' } : t))
    REQUESTS = REQUESTS.map((r) => (r.status === 'submitted' && voided.has(r.ticketCode) ? { ...r, status: 'approved', decidedAt: at, decidedBy: actor } : r))
    return detail(refunded)
  },
  /**
   * The event was cancelled: paid orders are refunded in full, fee included, and pending
   * orders are cancelled. Returns how many tickets were refunded.
   */
  async cancelEvent(eventId: string, reason: string, actor = 'Admin'): Promise<number> {
    const key = eventKeyFor(eventId)
    if (!key) return 0
    const at = now()
    const text = reason.trim()
    const note = text ? { en: text, ar: text } : undefined
    const paidIds = new Set(ORDERS.filter((o) => o.eventKey === key && o.status === 'paid').map((o) => o.id))
    const refunded = TICKETS.filter((t) => paidIds.has(t.orderId) && t.status === 'valid').length
    ORDERS = ORDERS.map((o) => {
      if (o.eventKey !== key) return o
      const reasonFor = { key: 'eventCancelled' as const, note, by: ADMIN_BY(actor), at }
      if (o.status === 'paid') return { ...o, status: 'refunded', payment: { ...o.payment, refundedAt: at, refundAmount: o.total }, reason: reasonFor }
      if (o.status === 'pending') return { ...o, status: 'cancelled', payment: { ...o.payment, cancelledAt: at }, reason: reasonFor }
      return o
    })
    TICKETS = TICKETS.map((t) => (paidIds.has(t.orderId) && t.status === 'valid' ? { ...t, status: 'cancelled' } : t))
    REQUESTS = REQUESTS.map((r) =>
      r.status === 'submitted' && TICKETS.find((t) => t.code === r.ticketCode)?.eventKey === key
        ? { ...r, status: 'approved', decidedAt: at, decidedBy: actor }
        : r,
    )
    return refunded
  },
  async resendTickets(id: string): Promise<void> {
    await delay(400)
    findOrder(id)
  },
  async remindPayment(id: string): Promise<void> {
    await delay(400)
    findOrder(id)
  },
}

export const ticketsApi = {
  async list(): Promise<Ticket[]> {
    await fetched(350)
    return TICKETS
  },
  async get(code: string): Promise<TicketDetail> {
    await fetched(300)
    const t = TICKETS.find((k) => k.code === code)
    if (!t) throw new OrderNotFoundError()
    return { ticket: t, event: EVENTS[t.eventKey], order: findOrder(t.orderId) }
  },
  async resend(code: string): Promise<void> {
    await delay(400)
    if (!TICKETS.some((k) => k.code === code)) throw new OrderNotFoundError()
  },
}

function requestRow(r: RefundRequest): RefundRequestRow {
  const ticket = TICKETS.find((t) => t.code === r.ticketCode)!
  const order = findOrder(ticket.orderId)
  const event = EVENTS[ticket.eventKey]
  const price = priceOf(order, ticket.category)
  const daysBefore = daysBetween(r.requestedAt, event.startsAt)
  return {
    ...r,
    ticket,
    order,
    event,
    amount: price,
    fee: Math.round(price * SERVICE_FEE),
    daysBefore,
    eligible: daysBefore >= REFUND_CUTOFF_DAYS,
  }
}

export const refundRequestsApi = {
  async list(): Promise<RefundRequestRow[]> {
    await fetched(350)
    return REQUESTS.map(requestRow)
  },
  /** Approve: the ticket is cancelled and its price goes back to the customer. */
  async approve(id: string, actor = 'Admin'): Promise<RefundRequestRow> {
    await fetched(400)
    const request = REQUESTS.find((r) => r.id === id)
    if (!request) throw new OrderNotFoundError()
    if (request.status !== 'submitted') throw new AdminApiError('request-decided')
    const row = requestRow(request)
    // The order was refunded, or the ticket used, after the customer asked.
    if (row.ticket.status !== 'valid' || row.order.status !== 'paid') throw new AdminApiError('ticket-not-refundable')
    const at = now()
    TICKETS = TICKETS.map((t) => (t.code === request.ticketCode ? { ...t, status: 'cancelled' } : t))
    ORDERS = ORDERS.map((o) => {
      if (o.id !== row.order.id) return o
      const allCancelled = TICKETS.filter((t) => t.orderId === o.id).every((t) => t.status === 'cancelled')
      const payment = { ...o.payment, refundAmount: (o.payment.refundAmount ?? 0) + row.amount, refundedAt: at }
      return allCancelled
        ? { ...o, status: 'refunded', payment, reason: { key: 'customer', note: request.note, by: ADMIN_BY(actor), at } }
        : { ...o, payment }
    })
    REQUESTS = REQUESTS.map((r) => (r.id === id ? { ...r, status: 'approved', decidedAt: at, decidedBy: actor } : r))
    return requestRow(REQUESTS.find((r) => r.id === id)!)
  },
  async reject(id: string, reason: string, actor = 'Admin'): Promise<RefundRequestRow> {
    await delay(400)
    const request = REQUESTS.find((r) => r.id === id)
    if (!request) throw new OrderNotFoundError()
    if (request.status !== 'submitted') throw new AdminApiError('request-decided')
    const text = reason.trim()
    REQUESTS = REQUESTS.map((r) =>
      r.id === id ? { ...r, status: 'rejected', decidedAt: now(), decidedBy: actor, rejectReason: { en: text, ar: text } } : r,
    )
    return requestRow(REQUESTS.find((r) => r.id === id)!)
  },
}

/** Everything the orders, tickets and refund-request tabs show, loaded together. */
export async function loadOrdersBook() {
  const [orders, tickets, requests] = await Promise.all([ordersApi.list(), ticketsApi.list(), refundRequestsApi.list()])
  return { orders, tickets, requests }
}
