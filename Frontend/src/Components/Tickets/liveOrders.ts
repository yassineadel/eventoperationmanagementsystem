import { ApiError } from '../../lib/api'
import { getMyOrders, getOrder, type OrderStatus } from '../../lib/bookingApi'
import type { EventsClient } from '../../lib/eventsApi'
import { eventPlaceholderImage } from '../../lib/eventImages'
import type { Event } from '../Homepage/types'
import { loadLiveTickets } from './liveTickets'
import type { SampleOrder, SampleTicket } from './ticketsModel'

export type LiveOrderConfirmation = {
  id: string
  status: OrderStatus
  order: SampleOrder
  tickets: SampleTicket[]
  quantity: number
  currency: string
  testPayment: boolean
}

export const isLiveOrderReference = (value: string) =>
  /^HF-[A-Z2-9]+$/.test(value) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)

// Read only the signed-in buyer's order. Neither receipt data nor QR tokens are stored locally.
export async function loadLiveOrder(identifier: string, client: EventsClient | null, signal: AbortSignal): Promise<LiveOrderConfirmation> {
  let id = identifier
  if (identifier.startsWith('HF-')) {
    const found = (await getMyOrders(signal)).find((order) => order.reference === identifier)
    if (!found) throw new ApiError('Order not found', 404)
    id = found.id
  }
  const saved = await getOrder(id, signal)
  const { tickets } = saved.status === 'PAID' ? await loadLiveTickets(client, signal, saved.reference) : { tickets: [] }
  let event: Event | undefined = tickets[0]?.event
  if (!event && client) {
    try { event = (await client.detail(saved.eventId, signal)).event }
    catch (error) { if (signal.aborted) throw error }
  }
  event ??= {
    id: saved.eventId, title: { en: saved.event.name, ar: saved.event.name },
    description: { en: '', ar: '' }, venue: { en: '', ar: '' },
    date: saved.event.startAt, category: 'concerts', city: 'cairo', source: 'api',
    price: null, status: 'available', image: eventPlaceholderImage(saved.event.name, 'concerts'),
    activity: { views: 0, registrations: 0 },
  }
  return {
    id: saved.id, status: saved.status, quantity: saved.items.reduce((count, item) => count + item.quantity, 0),
    currency: saved.currency, testPayment: saved.payment?.provider === 'simulator', tickets,
    order: {
      reference: saved.reference, event, createdAt: saved.createdAt,
      subtotal: Number(saved.subtotal), fees: Number(saved.serviceFeeTotal), total: Number(saved.total),
      ticketIds: tickets.map((ticket) => ticket.id),
    },
  }
}
