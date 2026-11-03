// Every call the buying journey makes to the backend.
// Prices come back as strings (the database stores exact decimals), so convert with Number() before showing them.
import { deleteJson, getJson, postJson } from './api'

// ---------- What the backend sends back ----------

export type AvailabilityCategory = {
  id: string
  categoryKey: string
  name: string
  price: string
  capacity: number
  available: number
  soldOut: boolean
}
export type Availability = {
  eventId: string
  categories: AvailabilityCategory[]
  heldSeatIds: string[]
  soldSeatIds: string[]
}

export type Hold = {
  id: string
  eventId: string
  ticketCategoryId: string
  seatId: string | null
  quantity: number
  status: string
  expiresAt: string
}

export type CartLine = {
  holdId: string
  ticketCategoryId: string
  category: string
  seat: string | null
  quantity: number
  unitPrice: string
  unitServiceFee: string
  serviceFeePercent: string
  lineTotal: string
}
export type Cart = {
  eventId: string
  lines: CartLine[]
  ticketCount: number
  subtotal: string
  serviceFeeTotal: string
  total: string
  currency: string
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
export type Order = {
  id: string
  reference: string
  eventId: string
  status: OrderStatus
  subtotal: string
  serviceFeeTotal: string
  total: string
  currency: string
  expiresAt: string
  paidAt: string | null
  createdAt: string
}

export type CheckoutResult = { order: Order; payment: { providerTxId: string } | null }

export type OrderDetail = Order & {
  items: { ticketCategoryId: string; quantity: number; unitPrice: string; serviceFeePercent: string; serviceFeeAmount: string }[]
  event: { id: string; name: string; startAt: string }
  payment: { status: string; provider: string } | null
}

export type SimulatedOutcome = 'success' | 'decline' | 'timeout' | 'success_lost' | 'success_twice'

// ---------- The calls ----------

// Public: how many tickets are left in each category, and which seats are taken
export const getAvailability = (eventId: string, signal?: AbortSignal) =>
  getJson<Availability>(`/api/inventory/events/${encodeURIComponent(eventId)}/availability`, { signal })

// Public: the venue's zones (standing) or seats (seated), for the seat map
export const getVenueLayout = (slug: string, signal?: AbortSignal) =>
  getJson<unknown>(`/api/venues/${encodeURIComponent(slug)}/layout`, { signal })

// A seated venue's layout: sections → rows → seats, in the order the venue defines them.
// Each seat's categoryKey links it to the event's ticket category with the same key.
export type LayoutSeat = { id: string; number: number; label: string; categoryKey: string }
export type SeatedLayout = { sections: { key: string; label: string; rows: { label: string; seats: LayoutSeat[] }[] }[] }

// Checks the layout from the server before the seat map uses it; anything unexpected is an error, not a broken map
export function parseSeatedLayout(value: unknown): SeatedLayout {
  const fail = () => { throw new Error('Invalid seat layout') }
  const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0
  const sections = (value as { sections?: unknown })?.sections
  if (!Array.isArray(sections) || !sections.length) fail()
  return {
    sections: (sections as unknown[]).map((section) => {
      const s = section as { key?: unknown; label?: unknown; rows?: unknown }
      if (!isText(s.key) || !Array.isArray(s.rows)) fail()
      return {
        key: s.key as string,
        label: isText(s.label) ? s.label : (s.key as string),
        rows: (s.rows as unknown[]).map((row) => {
          const r = row as { label?: unknown; seats?: unknown }
          if (!isText(r.label) || !Array.isArray(r.seats)) fail()
          return {
            label: r.label as string,
            seats: (r.seats as unknown[]).map((seat) => {
              const t = seat as { id?: unknown; number?: unknown; label?: unknown; categoryKey?: unknown }
              if (!isText(t.id) || !Number.isInteger(t.number) || !isText(t.categoryKey)) fail()
              return { id: t.id as string, number: t.number as number, label: isText(t.label) ? t.label : '', categoryKey: t.categoryKey as string }
            }),
          }
        }),
      }
    }),
  }
}

// Reserve places for 10 minutes. Standing venues: a quantity in one category.
export const holdStanding = (eventId: string, ticketCategoryId: string, quantity: number) =>
  postJson<{ message: string; holds: Hold[] }>('/api/inventory/holds', { eventId, ticketCategoryId, quantity })

// Seated venues: specific seats
export const holdSeats = (eventId: string, seatIds: string[]) =>
  postJson<{ message: string; holds: Hold[] }>('/api/inventory/holds', { eventId, seatIds })

// The signed-in user's active holds for one event (seat holds have a seatId; standing holds a quantity)
export const getMyHolds = (eventId: string, signal?: AbortSignal) =>
  getJson<Hold[]>(`/api/inventory/holds?eventId=${encodeURIComponent(eventId)}`, { signal })

// Give places back (the user removed them from the cart)
export const releaseHold = (holdId: string) =>
  deleteJson<{ message: string }>(`/api/inventory/holds/${encodeURIComponent(holdId)}`)

// The user's held tickets for one event, with prices and fees worked out by the server
export const getCart = (eventId: string, signal?: AbortSignal) =>
  getJson<Cart>(`/api/orders/cart?eventId=${encodeURIComponent(eventId)}`, { signal })

// Turn the holds into an order and start the payment.
// Make idempotencyKey ONCE per checkout attempt: sending it again never creates a second order.
export const checkout = (input: {
  eventId: string
  idempotencyKey: string
  policyAccepted: boolean
  attendees: { holdId: string; names: string[] }[]
}) => postJson<CheckoutResult>('/api/orders/checkout', input)

// Development only: tell the payment simulator what should happen
export const simulatePayment = (providerTxId: string, outcome: SimulatedOutcome) =>
  postJson<{ message: string }>(`/api/payments/simulator/${encodeURIComponent(providerTxId)}`, { outcome })

// One order. Ask again until status is no longer PENDING.
export const getOrder = (orderId: string, signal?: AbortSignal) =>
  getJson<OrderDetail>(`/api/orders/${encodeURIComponent(orderId)}`, { signal })

export const getMyOrders = (signal?: AbortSignal) => getJson<Order[]>('/api/orders', { signal })

// Give up before paying: stops the payment and releases the places
export const cancelOrder = (orderId: string) =>
  postJson<{ message: string }>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {})

// One ticket as GET /api/tickets sends it
export type ApiTicket = {
  id: string
  // TRANSFERRED_AWAY: the user gave it to someone else. EXPIRED: the event is over.
  status: 'VALID' | 'USED' | 'REFUNDED' | 'VOID' | 'TRANSFERRED_AWAY' | 'EXPIRED'
  attendeeName: string
  // Only sent while the ticket is VALID: this is what the gate scans
  qrToken: string | null
  orderReference: string
  category: string
  seat: { section: string; row: string; number: number } | null
  event: {
    id: string
    name: string
    startAt: string
    doorsOpenAt: string
    endsAt: string
    venue: { name: string; address: string | null; city: string }
  }
  transferCount: number
  transfersLeft: number
  usedAt: string | null
}

// The user's tickets, split into upcoming and past
export const getMyTickets = (signal?: AbortSignal) =>
  getJson<{ upcoming: ApiTicket[]; past: ApiTicket[] }>('/api/tickets', { signal })

export const getMyTicket = (ticketId: string, signal?: AbortSignal) =>
  getJson<ApiTicket>(`/api/tickets/${encodeURIComponent(ticketId)}`, { signal })

export type TicketTransferResult = { transferCount: number; transfersLeft: number; attendeeName?: string }
export const transferTicketToAccount = (ticketId: string, email: string, signal?: AbortSignal) =>
  postJson<TicketTransferResult>(`/api/tickets/${encodeURIComponent(ticketId)}/transfer`, { email }, { signal })

export const resendTicketEmail = (ticketId: string, signal?: AbortSignal) =>
  postJson<{ message: string }>(`/api/tickets/${encodeURIComponent(ticketId)}/resend`, {}, { signal })
