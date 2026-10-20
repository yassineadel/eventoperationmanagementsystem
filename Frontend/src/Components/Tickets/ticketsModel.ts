import { events } from '../Homepage/data/events.ts'
import type { Event, LocalizedText } from '../Homepage/types.ts'
import { getEventDetails } from '../Discovery/eventDetails.ts'
import { getBookingCatalogue } from '../Booking/catalogue.ts'
import { selectionTotals, validAttendee, type SampleReceipt, type Selection } from '../Booking/bookingModel.ts'
import { isSamplePaymentMethod, type SamplePaymentMethod } from '../Booking/paymentOptions.ts'

export type TicketRule = 'past' | 'used' | 'transferred' | 'refund-pending' | 'refunded' | 'transfer-limit' | 'transferred-before' | 'free' | 'cancelled' | 'recipient-invalid' | 'recipient-unverified' | 'recipient-self' | 'recipient-missing' | 'duplicate' | 'cooldown' | 'not-found' | 'confirmation' | 'refund-deadline'
export type TransferRecord = { at: string; recipientId: string; recipientName: string; recipientEmail: string }
export type SampleTicket = {
  id: string; orderRef: string; event: Event; endsAt: string; doorsOpenAt: string;
  venueAddress: LocalizedText; coordinates: readonly [number, number]; attendeeName: string;
  categoryId: string; categoryName: LocalizedText; seat: { section: string; row: string; number: number } | null;
  price: number; feePercent: number; serviceFee: number; paidTotal: number;
  status: 'active' | 'used' | 'transferred' | 'refund-pending' | 'refunded';
  ownerEmail: string; ownerName: string; transferCount: number; transfers: TransferRecord[];
  refund: { requestedAt: string; amount: number; fee: number } | null;
  codeVersion: number; resendCount: number; lastResentAt: string | null; resendTimes: string[];
}
export type PaymentReceipt = SampleReceipt & { paymentMethod?: SamplePaymentMethod }
export type SampleOrder = { reference: string; event: Event; createdAt: string; subtotal: number; fees: number; total: number; ticketIds: string[]; paymentMethod?: SamplePaymentMethod }
export type WalletState = { tickets: SampleTicket[]; orders: SampleOrder[] }
export type TicketResult = { ok: boolean; error?: TicketRule; orderRef?: string }
type Transition = TicketResult & { state: WalletState }
export const sampleOwner = { id: 'sample-owner', name: 'Youssef Hassan', email: 'youssef@example.com' }
export const sampleRecipients = [
  { id: 'sample-nour', name: 'Nour Ahmed', email: 'nour@example.com', verified: true },
  { id: 'sample-salma', name: 'Salma Ali', email: 'salma@example.com', verified: true },
  { id: 'sample-omar', name: 'Omar Khaled', email: 'omar@example.com', verified: false },
]
export const walletStorageKey = 'hafletna.sample-wallet.v1'
const day = 86_400_000
const round = (value: number) => Math.round(value * 100) / 100

function makeTicket(event: Event, reference: string, item: Selection, index: number, name: string): SampleTicket {
  const catalogue = getBookingCatalogue(event.id)!
  const category = catalogue.categories.find((category) => category.id === item.categoryId)!
  const seat = catalogue.seats.find((seat) => seat.id === item.seatId)
  const info = getEventDetails(event)
  const serviceFee = round(category.price * category.feePercent / 100)
  return { id: `${reference}-${index + 1}`, orderRef: reference, event: { ...event },
    endsAt: new Date(Date.parse(event.date) + info.duration * 60_000).toISOString(), doorsOpenAt: info.doorsOpen,
    venueAddress: info.address, coordinates: info.coordinates, attendeeName: name,
    categoryId: category.id, categoryName: category.name, seat: seat ? { section: seat.section, row: seat.row, number: seat.number } : null,
    price: category.price, feePercent: category.feePercent, serviceFee, paidTotal: round(category.price + serviceFee),
    status: 'active', ownerEmail: sampleOwner.email, ownerName: sampleOwner.name, transferCount: 0, transfers: [], refund: null,
    codeVersion: 1, resendCount: 0, lastResentAt: null, resendTimes: [] }
}

export function createSampleWallet(): WalletState {
  const concert = events.find((event) => event.id === 'cairo-after-dark')!
  const conference = events.find((event) => event.id === 'next-perspectives')!
  const past = { ...events.find((event) => event.id === 'design-together')!, date: '2026-09-12T10:00:00+03:00' }
  const free = events.find((event) => event.id === 'coastal-weekender')!
  const tickets = [
    makeTicket(concert, 'DEMO-A1B2C3D4', { key: 'middle-1', categoryId: 'middle' }, 0, sampleOwner.name),
    makeTicket(conference, 'DEMO-E5F6A7B8', { key: 'sample-next-perspectives-12', categoryId: 'front', seatId: 'sample-next-perspectives-12' }, 0, sampleOwner.name),
    makeTicket(past, 'DEMO-C1D2E3F4', { key: 'sample-design-together-2', categoryId: 'front', seatId: 'sample-design-together-2' }, 0, sampleOwner.name),
    makeTicket(free, 'DEMO-F1A2B3C4', { key: 'middle-1', categoryId: 'middle' }, 0, 'Nour Ahmed'),
  ]
  tickets[2].status = 'used'
  const orders: SampleOrder[] = tickets.map((ticket) => ({ reference: ticket.orderRef, event: ticket.event, createdAt: ticket.status === 'used' ? '2026-09-01T12:00:00Z' : '2026-10-18T12:00:00Z', subtotal: ticket.price, fees: ticket.serviceFee, total: ticket.paidTotal, ticketIds: [ticket.id], paymentMethod: ticket.paidTotal === 0 ? 'free' : 'card' }))
  return { tickets, orders }
}

export function ticketIsPast(ticket: SampleTicket, now: number) { return Date.parse(ticket.endsAt) <= now }
export function ticketEligibility(ticket: SampleTicket, kind: 'transfer' | 'refund', now: number): { allowed: boolean; reason: TicketRule | null } {
  let reason: TicketRule | null = null
  if (ticket.status === 'transferred') reason = 'transferred'
  else if (ticket.status === 'used') reason = 'used'
  else if (ticket.status === 'refunded') reason = 'refunded'
  else if (ticket.status === 'refund-pending') reason = 'refund-pending'
  else if (ticket.event.status === 'cancelled') reason = 'cancelled'
  else if (Date.parse(ticket.event.date) <= now) reason = 'past'
  else if (kind === 'transfer' && ticket.transferCount >= 3) reason = 'transfer-limit'
  else if (kind === 'refund' && ticket.transferCount > 0) reason = 'transferred-before'
  else if (kind === 'refund' && ticket.paidTotal === 0) reason = 'free'
  else if (kind === 'refund' && now > Date.parse(ticket.event.date) - 7 * day) reason = 'refund-deadline'
  return { allowed: !reason, reason }
}
export function refundQuote(ticket: SampleTicket, now: number) {
  const rule = ticketEligibility(ticket, 'refund', now)
  return { eligible: rule.allowed, reason: rule.reason, price: ticket.paidTotal, fee: ticket.serviceFee, amount: round(ticket.paidTotal - ticket.serviceFee), paidTotal: ticket.paidTotal, deadline: new Date(Date.parse(ticket.event.date) - 7 * day).toISOString() }
}
export function qrPayload(ticket: SampleTicket, now = Date.now()): string | null {
  // This is a real QR encoding a demo marker, never a venue admission credential.
  if (!['active', 'refund-pending'].includes(ticket.status) || ticket.event.status === 'cancelled' || ticketIsPast(ticket, now)) return null
  return `HAFLETNA-DEMO:NO-ENTRY:${ticket.id}:v${ticket.codeVersion}`
}

export function completeSampleOrder(state: WalletState, receipt: PaymentReceipt, items: Selection[], names: Record<string, string>, now: number): Transition {
  if (receipt.paymentMethod !== undefined && (!isSamplePaymentMethod(receipt.paymentMethod) || (receipt.total === 0 ? receipt.paymentMethod !== 'free' : receipt.paymentMethod === 'free'))) return { state, ok: false, error: 'not-found' }
  const paymentMethod = receipt.total === 0 ? 'free' : receipt.paymentMethod
  const existing = state.orders.find((order) => order.reference === receipt.reference)
  if (existing) {
    const same = existing.event.id === receipt.eventId && existing.total === receipt.total && existing.paymentMethod === paymentMethod && existing.ticketIds.length === receipt.quantity && items.length === receipt.quantity && items.every((item, index) => {
      const ticket = state.tickets.find((ticket) => ticket.id === existing.ticketIds[index])
      const seat = getBookingCatalogue(receipt.eventId)?.seats.find((seat) => seat.id === item.seatId)
      return ticket?.categoryId === item.categoryId && (ticket.seat ? seat?.row === ticket.seat.row && seat?.number === ticket.seat.number : !item.seatId)
    })
    return same ? { state, ok: true, orderRef: receipt.reference } : { state, ok: false, error: 'duplicate' }
  }
  const event = events.find((event) => event.id === receipt.eventId)
  const catalogue = getBookingCatalogue(receipt.eventId)
  if (!event || !catalogue || !Number.isFinite(receipt.total) || !Number.isFinite(now) || !/^DEMO-[A-F0-9]{8}$/.test(receipt.reference) || !items.length || items.length > 8 || receipt.quantity !== items.length || new Set(items.map((item) => item.key)).size !== items.length) return { state, ok: false, error: 'not-found' }
  if (items.some((item) => !validAttendee(names[item.key] ?? '') || !catalogue.categories.some((category) => category.id === item.categoryId) || (catalogue.mode === 'seated' ? !catalogue.seats.some((seat) => seat.id === item.seatId && seat.categoryId === item.categoryId && seat.status === 'available' && seat.id === item.key) : !!item.seatId || !new RegExp(`^${item.categoryId}-[1-8]$`).test(item.key)))) return { state, ok: false, error: 'not-found' }
  const totals = selectionTotals(event.id, items)
  if (Math.abs(totals.total - receipt.total) > 0.001) return { state, ok: false, error: 'not-found' }
  if (items.some((item) => item.seatId && state.tickets.some((ticket) => ticket.event.id === event.id && ticket.event.date === event.date && ticket.status !== 'refunded' && ticket.seat && catalogue.seats.some((seat) => seat.id === item.seatId && seat.row === ticket.seat!.row && seat.number === ticket.seat!.number)))) return { state, ok: false, error: 'duplicate' }
  const tickets = items.map((item, index) => makeTicket(event, receipt.reference, item, index, names[item.key].trim()))
  const order: SampleOrder = { reference: receipt.reference, event, createdAt: new Date(now).toISOString(), subtotal: totals.subtotal, fees: totals.fees, total: totals.total, ticketIds: tickets.map((ticket) => ticket.id), ...(paymentMethod ? { paymentMethod } : {}) }
  return { state: { tickets: [...state.tickets, ...tickets], orders: [...state.orders, order] }, ok: true, orderRef: receipt.reference }
}

export function transferSampleTicket(state: WalletState, id: string, email: string, confirmed: boolean, now: number): Transition {
  const ticket = state.tickets.find((ticket) => ticket.id === id)
  if (!ticket) return { state, ok: false, error: 'not-found' }
  const rule = ticketEligibility(ticket, 'transfer', now)
  if (!rule.allowed) return { state, ok: false, error: rule.reason! }
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { state, ok: false, error: 'recipient-invalid' }
  if (normalized === ticket.ownerEmail.toLowerCase()) return { state, ok: false, error: 'recipient-self' }
  const recipient = sampleRecipients.find((recipient) => recipient.email === normalized)
  if (!recipient) return { state, ok: false, error: 'recipient-missing' }
  if (!recipient.verified) return { state, ok: false, error: 'recipient-unverified' }
  if (!confirmed) return { state, ok: false, error: 'confirmation' }
  const next: SampleTicket = { ...ticket, status: 'transferred', transferCount: ticket.transferCount + 1, codeVersion: ticket.codeVersion + 1,
    transfers: [...ticket.transfers, { at: new Date(now).toISOString(), recipientId: recipient.id, recipientEmail: recipient.email, recipientName: recipient.name }] }
  return { state: { ...state, tickets: state.tickets.map((item) => item.id === id ? next : item) }, ok: true }
}
export function requestSampleRefund(state: WalletState, id: string, confirmed: boolean, now: number): Transition {
  const ticket = state.tickets.find((ticket) => ticket.id === id)
  if (!ticket) return { state, ok: false, error: 'not-found' }
  const quote = refundQuote(ticket, now)
  if (!quote.eligible) return { state, ok: false, error: quote.reason! }
  if (!confirmed) return { state, ok: false, error: 'confirmation' }
  const next: SampleTicket = { ...ticket, status: 'refund-pending', refund: { requestedAt: new Date(now).toISOString(), amount: quote.amount, fee: quote.fee } }
  return { state: { ...state, tickets: state.tickets.map((item) => item.id === id ? next : item) }, ok: true }
}
export function resendSampleTicket(state: WalletState, id: string, now: number): Transition {
  const ticket = state.tickets.find((ticket) => ticket.id === id)
  if (!ticket) return { state, ok: false, error: 'not-found' }
  if (!qrPayload(ticket, now)) return { state, ok: false, error: ticketEligibility(ticket, 'transfer', now).reason ?? 'past' }
  const recent = ticket.resendTimes.filter((at) => Date.parse(at) > now - 3_600_000)
  if (recent.length >= 3) return { state, ok: false, error: 'cooldown' }
  const at = new Date(now).toISOString()
  const next = { ...ticket, resendCount: ticket.resendCount + 1, lastResentAt: at, resendTimes: [...recent, at] }
  return { state: { ...state, tickets: state.tickets.map((item) => item.id === id ? next : item) }, ok: true }
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
function browserStorage(): Storage | null { try { return typeof window === 'undefined' ? null : window.sessionStorage } catch { return null } }
// Persist only catalogue references and lifecycle metadata. Entered attendee names,
// account names and contact details never leave memory or enter browser storage.
export function writeWallet(state: WalletState, storage: Storage | null = browserStorage()) {
  if (!storage) return false
  try {
    const seeded = new Set(createSampleWallet().orders.map((order) => order.reference))
    const orders = state.orders.filter((order) => !seeded.has(order.reference)).map((order) => ({ reference: order.reference, eventId: order.event.id, createdAt: order.createdAt, ...(isSamplePaymentMethod(order.paymentMethod) ? { paymentMethod: order.paymentMethod } : {}),
      items: order.ticketIds.flatMap((id, index) => { const ticket = state.tickets.find((ticket) => ticket.id === id); if (!ticket) return []; const seat = getBookingCatalogue(order.event.id)?.seats.find((seat) => seat.row === ticket.seat?.row && seat.number === ticket.seat?.number); return [{ key: seat?.id ?? `${ticket.categoryId}-${index + 1}`, categoryId: ticket.categoryId, ...(seat ? { seatId: seat.id } : {}) }] }) }))
    const lifecycle = state.tickets.map((ticket) => ({ id: ticket.id, status: ticket.status, transferCount: ticket.transferCount, codeVersion: ticket.codeVersion,
      transfers: ticket.transfers.map(({ at, recipientId }) => ({ at, recipientId })), refund: ticket.refund ? { requestedAt: ticket.refund.requestedAt, amount: ticket.refund.amount, fee: ticket.refund.fee } : null, resendCount: ticket.resendCount, lastResentAt: ticket.lastResentAt, resendTimes: ticket.resendTimes }))
    storage.setItem(walletStorageKey, JSON.stringify({ version: 1, orders, lifecycle }))
    return true
  } catch { return false }
}
export function readWallet(storage: Storage | null = browserStorage()): WalletState {
  let state = createSampleWallet()
  try {
    const raw = JSON.parse(storage?.getItem(walletStorageKey) ?? 'null')
    if (raw?.version !== 1 || !Array.isArray(raw.orders) || !Array.isArray(raw.lifecycle)) return state
    for (const order of raw.orders.slice(0, 100)) {
      if (!order || !Array.isArray(order.items) || !Number.isFinite(Date.parse(order.createdAt))) continue
      const items: Selection[] = order.items.filter((item: Selection) => item && typeof item.key === 'string' && typeof item.categoryId === 'string').map((item: Selection) => ({ key: item.key, categoryId: item.categoryId, ...(typeof item.seatId === 'string' ? { seatId: item.seatId } : {}) }))
      const totals = selectionTotals(order.eventId, items)
      const method = isSamplePaymentMethod(order.paymentMethod) && (totals.total === 0 ? order.paymentMethod === 'free' : order.paymentMethod !== 'free') ? order.paymentMethod : undefined
      state = completeSampleOrder(state, { reference: order.reference, eventId: order.eventId, total: totals.total, quantity: items.length, paymentMethod: method }, items, Object.fromEntries(items.map((item) => [item.key, 'Sample attendee'])), Date.parse(order.createdAt)).state
    }
    const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
    const statuses: SampleTicket['status'][] = ['active', 'used', 'transferred', 'refund-pending', 'refunded']
    state = { ...state, tickets: state.tickets.map((ticket) => {
      const life = raw.lifecycle.find((item: { id?: unknown }) => item?.id === ticket.id)
      if (!life || !statuses.includes(life.status) || !Number.isInteger(life.transferCount) || life.transferCount < 0 || life.transferCount > 3 || !Number.isInteger(life.codeVersion) || life.codeVersion < 1 || life.codeVersion > 4) return ticket
      const transfers: TransferRecord[] = Array.isArray(life.transfers) ? life.transfers.slice(0, 3).flatMap((record: { at: unknown; recipientId: unknown }) => { const recipient = sampleRecipients.find((recipient) => recipient.verified && recipient.id === record?.recipientId); return recipient && validDate(record.at) ? [{ at: record.at, recipientId: recipient.id, recipientName: recipient.name, recipientEmail: recipient.email }] : [] }) : []
      if (life.transferCount !== transfers.length || life.codeVersion !== ticket.codeVersion + transfers.length || (life.status === 'transferred' && !transfers.length) || (life.status !== 'transferred' && transfers.length > 0)) return ticket
      const quote = refundQuote(ticket, 0)
      const refund = life.refund && validDate(life.refund.requestedAt) && life.refund.amount === quote.amount && life.refund.fee === quote.fee ? { requestedAt: life.refund.requestedAt, amount: quote.amount, fee: quote.fee } : null
      if (life.status === 'refund-pending' && (!refund || life.transferCount > 0)) return ticket
      const resendTimes: string[] = Array.isArray(life.resendTimes) ? life.resendTimes.filter(validDate).slice(-3) : []
      return { ...ticket, status: life.status, transferCount: life.transferCount, codeVersion: life.codeVersion, transfers, refund, resendCount: Number.isInteger(life.resendCount) && life.resendCount >= 0 ? Math.min(life.resendCount, 10000) : 0, lastResentAt: validDate(life.lastResentAt) ? life.lastResentAt : null, resendTimes }
    }) }
  } catch { /* Malformed or blocked storage falls back to the sample wallet. */ }
  return state
}
