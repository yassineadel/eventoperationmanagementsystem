// Orders and tickets for the admin console.
//
// The backend does not expose order or ticket endpoints yet, so this module serves
// sample data: eight orders across four events, with their items, payment, tickets and,
// for refunded or cancelled orders, the reason. Refunds, reminders and resends change
// the sample data in memory until the page reloads. When the API exists, replace the
// bodies of `ordersApi.*` and `ticketsApi.*` with calls from './api'.

export type OrderStatus = 'paid' | 'pending' | 'refunded' | 'cancelled'
export type TicketStatus = 'valid' | 'checked' | 'cancelled'
export type RefundReason = 'customer' | 'eventChanged' | 'duplicate' | 'other'
export type ReasonKey = RefundReason | 'paymentFailed'

/** Copy written by people (notes, who did it) comes in both languages. */
export type Localized = { en: string; ar: string }

export type EventInfo = {
  key: string
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
  cancelledAt?: string
  declined?: boolean
}

export type OrderReason = { key: ReasonKey; note?: Localized; by: Localized; at: string }

export type Order = {
  id: string
  customer: { name: string; email: string; phone: string }
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

/** "Today" in the sample data, so past and upcoming events stay put. */
export const SAMPLE_NOW = '2026-10-19T12:00'

/* ----------------------------------------------------------- sample data */

export const EVENTS: Record<string, EventInfo> = {
  jazz: { key: 'jazz', name: 'Cairo Jazz Night', venue: 'Nile Arena', venueId: '7c1e4b2a-91d3-4f0e-a6b5-2d8f3c9e1a07', startsAt: '2026-10-24T20:00' },
  sunset: { key: 'sunset', name: 'Sunset Beats', venue: 'Riverfront Stage', venueId: 'b84f0c6d-3e2a-47b9-8d15-6a0e9f4c2b31', startsAt: '2026-10-31T17:00' },
  standup: { key: 'standup', name: 'Stand-Up Friday', venue: 'Downtown Hall', venueId: '3a9d7e15-c2f8-4b60-9e4a-81b5d0f6c7e2', startsAt: '2026-10-16T21:00' },
  acoustic: { key: 'acoustic', name: 'Acoustic Nights', venue: 'Garden Amphitheater', venueId: 'e2c5a8f1-6b4d-4d7e-b0a3-9f1c8e2d5b46', startsAt: '2026-11-14T18:30' },
}

type OrderSeed = Omit<Order, 'qty' | 'subtotal' | 'fee' | 'total'>

const SERVICE_FEE = 0.03

function minutesAfter(iso: string, minutes: number) {
  const d = new Date(`${iso}:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString().slice(0, 16)
}

const SEEDS: OrderSeed[] = [
  {
    id: 'HF-10241',
    customer: { name: 'Mariam Hassan', email: 'mariam.hassan@example.com', phone: '+20 100 123 4567' },
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
    customer: { name: 'Omar Khaled', email: 'omar.khaled@example.com', phone: '+20 111 482 9031' },
    eventKey: 'sunset',
    status: 'pending',
    placedAt: '2026-10-12T18:05',
    items: [{ category: 'General', unitPrice: 600, qty: 2 }],
    payment: { method: 'Fawry', fawry: true, reference: '7731 2290', dueBy: '2026-10-13T18:05' },
  },
  {
    id: 'HF-10239',
    customer: { name: 'Salma Adel', email: 'salma.adel@example.com', phone: '+20 122 905 1176' },
    eventKey: 'standup',
    status: 'paid',
    placedAt: '2026-10-11T22:14',
    items: [{ category: 'Standard', unitPrice: 400, qty: 4 }],
    payment: { method: 'Mastercard ·· 8810', fawry: false, reference: 'PAY-2M7D4R', paidAt: '2026-10-11T22:16' },
  },
  {
    id: 'HF-10238',
    customer: { name: 'Youssef Tarek', email: 'youssef.tarek@example.com', phone: '+20 101 377 6402' },
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
    },
    reason: {
      key: 'customer',
      note: {
        en: 'The customer can’t attend anymore because of a family emergency and asked for a full refund.',
        ar: 'لم يعد بإمكان العميل الحضور بسبب ظرف عائلي طارئ وطلب استردادًا كاملًا.',
      },
      by: { en: 'Nadine Farouk · Support', ar: 'نادين فاروق · الدعم' },
      at: '2026-10-13T10:05',
    },
  },
  {
    id: 'HF-10237',
    customer: { name: 'Habiba Mostafa', email: 'habiba.mostafa@example.com', phone: '+20 155 640 2218' },
    eventKey: 'acoustic',
    status: 'paid',
    placedAt: '2026-10-10T13:52',
    items: [{ category: 'General', unitPrice: 400, qty: 2 }],
    payment: { method: 'Meeza ·· 3302', fawry: false, reference: 'PAY-4H8N1V', paidAt: '2026-10-10T13:54' },
  },
  {
    id: 'HF-10236',
    customer: { name: 'Karim Fathy', email: 'karim.fathy@example.com', phone: '+20 128 214 7750' },
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
    customer: { name: 'Laila Samir', email: 'laila.samir@example.com', phone: '+20 106 831 5524' },
    eventKey: 'standup',
    status: 'paid',
    placedAt: '2026-10-09T21:47',
    items: [{ category: 'Standard', unitPrice: 400, qty: 2 }],
    payment: { method: 'Visa ·· 5521', fawry: false, reference: 'PAY-9L2W6B', paidAt: '2026-10-09T21:49' },
  },
  {
    id: 'HF-10234',
    customer: { name: 'Nour El-Din Ali', email: 'nour.ali@example.com', phone: '+20 114 270 6698' },
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

/* ------------------------------------------------------------------- api */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

export const ordersApi = {
  async list(): Promise<Order[]> {
    await delay(350)
    return ORDERS
  },
  async get(id: string): Promise<OrderDetail> {
    await delay(300)
    return detail(findOrder(id))
  },
  /** Full refund: the order turns refunded and every ticket stops working at the gate. */
  async refund(id: string, input: { reason: RefundReason; note: string }): Promise<OrderDetail> {
    await delay(500)
    const order = findOrder(id)
    if (order.status !== 'paid') throw new Error('Only paid orders can be refunded')
    const at = minutesAfter(SAMPLE_NOW, 0)
    const note = input.note.trim()
    const refunded: Order = {
      ...order,
      status: 'refunded',
      payment: { ...order.payment, refundedAt: at },
      reason: { key: input.reason, note: note ? { en: note, ar: note } : undefined, by: { en: 'Admin', ar: 'المسؤول' }, at },
    }
    ORDERS = ORDERS.map((o) => (o.id === id ? refunded : o))
    TICKETS = TICKETS.map((t) => (t.orderId === id ? { ...t, status: 'cancelled' } : t))
    return detail(refunded)
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
    await delay(350)
    return TICKETS
  },
  async get(code: string): Promise<TicketDetail> {
    await delay(300)
    const t = TICKETS.find((k) => k.code === code)
    if (!t) throw new OrderNotFoundError()
    return { ticket: t, event: EVENTS[t.eventKey], order: findOrder(t.orderId) }
  },
  async resend(code: string): Promise<void> {
    await delay(400)
    if (!TICKETS.some((k) => k.code === code)) throw new OrderNotFoundError()
  },
}

export { minutesAfter }
