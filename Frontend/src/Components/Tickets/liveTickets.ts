import { useContext, useEffect, useState } from 'react'
import { getMyTickets, type ApiTicket } from '../../lib/bookingApi'
import { fallbackImages } from '../../lib/eventsModel'
import { EventsClientContext } from '../../lib/useEventsApi'
import type { EventsClient } from '../../lib/eventsApi'
import type { Event, LocalizedText } from '../Homepage/types'
import type { SampleTicket } from './ticketsModel'

const text = (value: string): LocalizedText => ({ en: value, ar: value })

// The wallet pages show one status per ticket
const statusOf = (status: ApiTicket['status']): SampleTicket['status'] =>
  status === 'USED' ? 'used' : status === 'REFUNDED' ? 'refunded' : status === 'TRANSFERRED_AWAY' ? 'transferred' : 'active'

// Used when the event's page can't be loaded: enough to show the ticket
function fallbackEvent(ticket: ApiTicket): Event {
  return {
    id: ticket.event.id, title: text(ticket.event.name), description: text(''), venue: text(ticket.event.venue.name),
    category: 'concerts', city: 'cairo', date: ticket.event.startAt, price: null, source: 'api',
    status: 'available', image: fallbackImages.concerts, activity: { views: 0, registrations: 0 },
  }
}

/**
 * Turns a ticket from the backend into the shape Youssef's wallet pages already use.
 * Prices are not sent with a ticket, so they stay 0 (the cards don't show them).
 */
function toWalletTicket(ticket: ApiTicket, event: Event, coordinates: readonly [number, number] | null): SampleTicket {
  return {
    id: ticket.id,
    orderRef: ticket.orderReference,
    event: { ...event, date: ticket.event.startAt, status: ticket.status === 'VOID' ? 'cancelled' : event.status },
    endsAt: ticket.event.endsAt,
    doorsOpenAt: ticket.event.doorsOpenAt,
    venueAddress: text(ticket.event.venue.address ?? ''),
    // [0, 0] means "no location known": the ticket page then hides the map link
    coordinates: coordinates ?? [0, 0],
    attendeeName: ticket.attendeeName,
    categoryId: '',
    categoryName: text(ticket.category),
    seat: ticket.seat,
    price: 0, feePercent: 0, serviceFee: 0, paidTotal: 0,
    status: statusOf(ticket.status),
    ownerEmail: '', ownerName: '',
    transferCount: ticket.transferCount,
    transfers: [], refund: null,
    codeVersion: 1, resendCount: 0, lastResentAt: null, resendTimes: [],
  }
}

// Loads the user's tickets, plus each event's page once (for its photo, texts and location)
async function loadLiveTickets(client: EventsClient | null, signal: AbortSignal) {
  const { upcoming, past } = await getMyTickets(signal)
  const all = [...upcoming, ...past]

  const events = new Map<string, { event: Event; coordinates: readonly [number, number] | null }>()
  const eventIds = [...new Set(all.map((ticket) => ticket.event.id))]
  await Promise.all(eventIds.map(async (id) => {
    try {
      if (client) {
        const page = await client.detail(id, signal)
        events.set(id, { event: page.event, coordinates: page.details.coordinates })
      }
    } catch {
      // fallbackEvent() is used for this one
    }
  }))

  const tickets = all.map((ticket) => {
    const found = events.get(ticket.event.id)
    return toWalletTicket(ticket, found?.event ?? fallbackEvent(ticket), found?.coordinates ?? null)
  })
  // The QR code of each ticket, by ticket id (null when the ticket can't be used)
  const qrTokens: Record<string, string | null> = Object.fromEntries(all.map((ticket) => [ticket.id, ticket.qrToken]))
  return { tickets, qrTokens }
}

/**
 * The signed-in user's real tickets and their QR codes. tickets is null while loading.
 */
export function useLiveTickets(enabled: boolean) {
  const client = useContext(EventsClientContext)
  const [data, setData] = useState<{ tickets: SampleTicket[]; qrTokens: Record<string, string | null> } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    loadLiveTickets(client, controller.signal)
      .then(setData)
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [enabled, client])

  return { tickets: data?.tickets ?? null, qrTokens: data?.qrTokens ?? {}, failed }
}