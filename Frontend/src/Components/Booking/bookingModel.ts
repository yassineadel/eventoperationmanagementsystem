import { events } from '../Homepage/data/events.ts'
import { getBookingCatalogue, getBookingEvent } from './catalogue.ts'
import { eventIdPattern } from '../../lib/eventsModel.ts'

export const MAX_TICKETS = 8
export const HOLD_MS = 10 * 60_000
export const bookingStorageKey = 'hafletna.sample-booking.v1'
export type Selection = { key: string; categoryId: string; seatId?: string }
export type SamplePurchase = { quantity: number; seats: string[]; categories: Record<string, number> }
export type SampleReceipt = { reference: string; eventId: string; total: number; quantity: number }
export type BookingState = {
  eventId: string | null; items: Selection[]; expiresAt: number | null; expired: boolean;
  purchases: Record<string, SamplePurchase>; receipt: SampleReceipt | null
}
export type BookingError = 'unavailable' | 'limit' | 'replace' | 'expired' | 'invalid' | 'empty'
export type BookingAction =
  | { type: 'select'; eventId: string; items: Selection[] }
  | { type: 'reset'; eventId: string }
  | { type: 'remove'; key: string }
  | { type: 'expire' }
  | { type: 'release' }
  | { type: 'complete'; reference: string }
  | { type: 'held'; expiresAt: number }
export type BookingResult = { state: BookingState; error?: BookingError }

export function emptyBooking(): BookingState {
  return { eventId: null, items: [], expiresAt: null, expired: false, purchases: {}, receipt: null }
}
export function categoryRemaining(state: BookingState, eventId: string, categoryId: string) {
  const catalogue = getBookingCatalogue(eventId)
  if (!catalogue) return 0
  const bought = state.purchases[eventId]
  if (catalogue.mode === 'seated') return catalogue.seats.filter((seat) => seat.categoryId === categoryId && seat.status === 'available' && !bought?.seats.includes(seat.id)).length
  return Math.max(0, (catalogue.categories.find((category) => category.id === categoryId)?.remaining ?? 0) - (bought?.categories[categoryId] ?? 0))
}
export function selectionTotals(eventId: string | null, items: Selection[]) {
  const categories = eventId ? getBookingCatalogue(eventId)?.categories ?? [] : []
  const lines = items.map((item) => {
    const category = categories.find((category) => category.id === item.categoryId)
    const price = category?.price ?? 0
    const fee = Math.round(price * (category?.feePercent ?? 0)) / 100
    return { ...item, price, fee, total: price + fee }
  })
  const subtotal = lines.reduce((total, line) => total + line.price, 0)
  const fees = Math.round(lines.reduce((total, line) => total + line.fee, 0) * 100) / 100
  return { lines, subtotal, fees, total: Math.round((subtotal + fees) * 100) / 100 }
}
export function validAttendee(name: string) { return name.trim().length >= 2 && name.trim().length <= 100 }

export function transitionBooking(state: BookingState, action: BookingAction, now: number): BookingResult {
  const timedOut = state.expiresAt !== null && now >= state.expiresAt
  if (action.type === 'expire') return { state: timedOut ? { ...state, items: [], expiresAt: null, expired: true } : state }
    // The server reserved the tickets: its deadline replaces the local one
  if (action.type === 'held') return { state: { ...state, expiresAt: action.expiresAt, expired: false } }
  if (action.type === 'release') return { state: { ...state, items: [], expiresAt: null, expired: false, receipt: null } }
  if (action.type === 'reset') {
    if (!getBookingCatalogue(action.eventId)) return { state, error: 'invalid' }
    return { state: { ...state, eventId: action.eventId, items: [], expiresAt: null, expired: false, receipt: null } }
  }
  if (timedOut || state.expired) return { state: timedOut ? { ...state, items: [], expiresAt: null, expired: true } : state, error: 'expired' }
  if (action.type === 'remove') {
    const items = state.items.filter((item) => item.key !== action.key)
    return { state: { ...state, items, expiresAt: items.length ? state.expiresAt : null } }
  }
  const eventId = action.type === 'select' ? action.eventId : state.eventId
  const event = eventId ? getBookingEvent(eventId) : undefined
  const catalogue = eventId ? getBookingCatalogue(eventId) : null
  if (!event || !eventId || !catalogue) return { state, error: 'invalid' }
  if (event.status !== 'available' || Date.parse(event.date) <= now) return { state, error: 'unavailable' }
  if (action.type === 'select' && state.items.length && state.eventId !== eventId) return { state, error: 'replace' }
  const items = action.type === 'select' ? action.items : state.items
  const purchased = state.purchases[eventId]
  if (items.length + (purchased?.quantity ?? 0) > MAX_TICKETS) return { state, error: 'limit' }
  if (new Set(items.map((item) => item.key)).size !== items.length) return { state, error: 'invalid' }
  for (const item of items) {
    if (!catalogue.categories.some((category) => category.id === item.categoryId)) return { state, error: 'invalid' }
    if (catalogue.mode === 'seated') {
      const seat = catalogue.seats.find((seat) => seat.id === item.seatId)
      if (!seat || item.key !== seat.id || seat.categoryId !== item.categoryId || seat.status !== 'available' || purchased?.seats.includes(seat.id)) return { state, error: 'unavailable' }
    } else if (item.seatId || !new RegExp(`^${item.categoryId}-[1-8]$`).test(item.key)) return { state, error: 'invalid' }
  }
  for (const category of catalogue.categories) {
    if (items.filter((item) => item.categoryId === category.id).length > categoryRemaining(state, eventId, category.id)) return { state, error: 'unavailable' }
  }
  if (action.type === 'select') return { state: { ...state, eventId, items: items.map((item) => ({ key: item.key, categoryId: item.categoryId, ...(item.seatId ? { seatId: item.seatId } : {}) })), expiresAt: items.length ? state.expiresAt ?? now + HOLD_MS : null, expired: false, receipt: null } }
  if (!items.length || !state.expiresAt) return { state, error: 'empty' }
  if (!/^DEMO-[A-F0-9]{8}$/.test(action.reference)) return { state, error: 'invalid' }
  const purchase: SamplePurchase = { quantity: (purchased?.quantity ?? 0) + items.length, seats: [...(purchased?.seats ?? []), ...items.flatMap((item) => item.seatId ? [item.seatId] : [])], categories: { ...purchased?.categories } }
  for (const item of items) purchase.categories[item.categoryId] = (purchase.categories[item.categoryId] ?? 0) + 1
  return { state: { ...state, items: [], expiresAt: null, expired: false, purchases: { ...state.purchases, [eventId]: purchase }, receipt: { reference: action.reference, eventId, quantity: items.length, total: selectionTotals(eventId, items).total } } }
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.sessionStorage } catch { return null } }
export function readBooking(storage: Storage | null = browserStorage(), now = Date.now()): BookingState {
  try {
    const raw = JSON.parse(storage?.getItem(bookingStorageKey) ?? 'null')
    if (!raw || typeof raw !== 'object') return emptyBooking()
    let state = emptyBooking()
    for (const event of events) {
      const purchase = raw.purchases?.[event.id]
      const catalogue = getBookingCatalogue(event.id)!
      if (!purchase || !Number.isInteger(purchase.quantity) || purchase.quantity < 0 || purchase.quantity > MAX_TICKETS) continue
      const seats = Array.isArray(purchase.seats) ? [...new Set<string>(purchase.seats.filter((id: unknown) => typeof id === 'string' && catalogue.seats.some((seat) => seat.id === id && seat.status === 'available')))] : []
      const categories: Record<string, number> = {}
      for (const category of catalogue.categories) {
        const count = purchase.categories?.[category.id]
        categories[category.id] = Number.isInteger(count) && count >= 0 && count <= MAX_TICKETS ? count : 0
      }
      if (Object.values(categories).reduce((a, b) => a + b, 0) !== purchase.quantity || catalogue.mode === 'seated' && (seats.length !== purchase.quantity || catalogue.categories.some((category) => seats.filter((id) => catalogue.seats.find((seat) => seat.id === id)?.categoryId === category.id).length !== categories[category.id]))) continue
      state.purchases[event.id] = { quantity: purchase.quantity, seats, categories }
    }
    if (typeof raw.eventId !== 'string') return state
    // A real event (its id is a UUID): its catalogue only exists once it is loaded from the server again.
    // Keep only which event it was, and whether its timer had run out. The tickets themselves are NOT
    // taken from storage: LiveBookingRestore rebuilds them from the server's holds.
    if (!getBookingCatalogue(raw.eventId)) {
      if (!eventIdPattern.test(raw.eventId)) return state
      const timedOut = raw.expired === true || typeof raw.expiresAt === 'number' && now >= raw.expiresAt
      return { ...state, eventId: raw.eventId.toLowerCase(), expired: timedOut }
    }
    state.eventId = raw.eventId
    if (raw.expired === true || typeof raw.expiresAt === 'number' && now >= raw.expiresAt) return { ...state, expired: true }
    if (Array.isArray(raw.items) && raw.items.length && Number.isFinite(raw.expiresAt) && raw.expiresAt > now && raw.expiresAt <= now + HOLD_MS) {
      const items = raw.items.filter((item: unknown): item is Selection => Boolean(item && typeof item === 'object' && typeof (item as Selection).key === 'string' && typeof (item as Selection).categoryId === 'string'))
      if (items.length !== raw.items.length) return state
      const result = transitionBooking(state, { type: 'select', eventId: raw.eventId, items }, now)
      if (!result.error) state = { ...result.state, expiresAt: raw.expiresAt }
    }
    const receipt = raw.receipt
    const maxPrice = Math.max(...getBookingCatalogue(raw.eventId)!.categories.map((category) => category.price * (1 + category.feePercent / 100)))
    if (!state.items.length && receipt && typeof receipt.reference === 'string' && /^DEMO-[A-F0-9]{8}$/.test(receipt.reference) && receipt.eventId === state.eventId && Number.isFinite(receipt.total) && receipt.total >= 0 && receipt.total <= Math.ceil(maxPrice * receipt.quantity * 100) / 100 && Number.isInteger(receipt.quantity) && receipt.quantity > 0 && receipt.quantity <= MAX_TICKETS && state.purchases[receipt.eventId]?.quantity >= receipt.quantity) state.receipt = { reference: receipt.reference, eventId: receipt.eventId, quantity: receipt.quantity, total: receipt.total }
    return state
  } catch { return emptyBooking() }
}
export function writeBooking(state: BookingState, storage: Storage | null = browserStorage()) {
  if (!storage) return false
  try {
    // Explicit whitelist: attendee names, contact details and payment fields are never persisted.
    const purchases = Object.fromEntries(Object.entries(state.purchases).map(([eventId, purchase]) => [eventId, { quantity: purchase.quantity, seats: [...purchase.seats], categories: Object.fromEntries(['front', 'middle', 'rear'].map((id) => [id, purchase.categories[id] ?? 0])) }]))
    const receipt = state.receipt ? { reference: state.receipt.reference, eventId: state.receipt.eventId, quantity: state.receipt.quantity, total: state.receipt.total } : null
    storage.setItem(bookingStorageKey, JSON.stringify({ eventId: state.eventId, items: state.items.map(({ key, categoryId, seatId }) => ({ key, categoryId, ...(seatId ? { seatId } : {}) })), expiresAt: state.expiresAt, expired: state.expired, purchases, receipt }))
    return true
  } catch { return false }
}
