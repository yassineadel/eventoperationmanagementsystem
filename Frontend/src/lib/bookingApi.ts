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

export type CheckoutResult = { order: Order; payment: { providerTxId: string } }

export type SimulatedOutcome = 'success' | 'decline' | 'timeout' | 'success_lost' | 'success_twice'

// ---------- The calls ----------

// Public: how many tickets are left in each category, and which seats are taken
export const getAvailability = (eventId: string, signal?: AbortSignal) =>
  getJson<Availability>(`/api/inventory/events/${encodeURIComponent(eventId)}/availability`, { signal })

// Public: the venue's zones (standing) or seats (seated), for the seat map
export const getVenueLayout = (slug: string, signal?: AbortSignal) =>
  getJson<unknown>(`/api/venues/${encodeURIComponent(slug)}/layout`, { signal })

// Reserve places for 10 minutes. Standing venues: a quantity in one category.
export const holdStanding = (eventId: string, ticketCategoryId: string, quantity: number) =>
  postJson<{ message: string; holds: Hold[] }>('/api/inventory/holds', { eventId, ticketCategoryId, quantity })

// Seated venues: specific seats
export const holdSeats = (eventId: string, seatIds: string[]) =>
  postJson<{ message: string; holds: Hold[] }>('/api/inventory/holds', { eventId, seatIds })

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
  getJson<Order>(`/api/orders/${encodeURIComponent(orderId)}`, { signal })

// Give up before paying: stops the payment and releases the places
export const cancelOrder = (orderId: string) =>
  postJson<{ message: string }>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {})

// The user's tickets, split into upcoming and past
export const getMyTickets = (signal?: AbortSignal) =>
  getJson<{ upcoming: unknown[]; past: unknown[] }>('/api/tickets', { signal })