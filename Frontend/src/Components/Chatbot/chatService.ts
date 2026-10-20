import { events } from '../Homepage/data/events.ts'
import { getEventDetails } from '../Discovery/eventDetails.ts'
import type { Category, City, Event } from '../Homepage/types.ts'
import type { ChatLink, ChatReply, ChatSend } from './types.ts'

// This local adapter reads the public fictional catalogue only. It never receives
// authentication, account, cart, order, attendee, or ticket data.
const categories: { id: Category; words: RegExp; label: string }[] = [
  { id: 'concerts', words: /\b(music|concerts?|acoustic|live music)\b/, label: 'Concerts' },
  { id: 'festivals', words: /\b(festivals?|celebration)\b/, label: 'Festivals' },
  { id: 'arts', words: /\b(arts?|culture|cultural|gallery)\b/, label: 'Arts & culture' },
  { id: 'sports', words: /\b(sports?|running|run|fitness|5k)\b/, label: 'Sports' },
  { id: 'workshops', words: /\b(workshops?|design|learn|learning)\b/, label: 'Workshops' },
  { id: 'conferences', words: /\b(conferences?|networking|talks?|business)\b/, label: 'Conferences' },
]
const cities: City[] = ['cairo', 'alexandria', 'giza']
const eventPath = (event: Event) => `/events/${encodeURIComponent(event.id)}`
const eventLink = (event: Event): ChatLink => ({ label: event.title.en, to: eventPath(event) })
const money = (price: number) => price === 0 ? 'Free admission' : `From EGP ${price.toFixed(2)} before category service fees`
const dayTime = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(date))
const statusLabels = { available: 'Available in the sample catalogue', 'sold-out': 'Sold out in the sample catalogue', cancelled: 'Cancelled in the sample catalogue' }
const refundHelp = 'Sample voluntary-refund policy: request at least seven days before the event starts. The refundable amount is the original charged total minus the category service fee; that fee is not refundable. Free tickets and tickets with transfer history are not eligible. Requests require administrator approval. The preview records a request only: no money is returned. Open My Tickets, choose a ticket, then Request refund to see its eligibility and exact sample quote.'
const transferHelp = 'A transfer gives your ticket to another person so they attend instead of you. In My Tickets, open a ticket, choose Transfer ticket, select a verified registered sample recipient, review the details, and confirm. Your current QR code becomes unavailable and a transfer record remains. The sample rules allow at most three transfers per ticket and no refund after a transfer. Used, cancelled, refunded, already transferred, or started-event tickets cannot be transferred; a pending refund also blocks transfer. This preview does not deliver a ticket to another account or send an email.'
const buyHelp = 'Open an event and choose Select tickets. Choose seats on the sample seat map, or a standing zone and quantity, then continue to the cart. Review attendee names and proceed to checkout. The preview offers sample card, mobile wallet, and bank-transfer methods. Prices and category service fees are shown before confirmation. No real availability is checked, no seats are held, and no payment is collected.'

function describeEvent(event: Event, now: number): string {
  return `${event.title.en}\n${dayTime(event.date)} (Egypt time)\n${event.venue.en}, ${event.city[0].toUpperCase()}${event.city.slice(1)}\n${money(event.price)}.\n${statusLabels[event.status]}.${Date.parse(event.date) <= now ? ' The listed start time has passed.' : ''}\n${event.description.en}\nAll event and venue information is fictional sample data; status is not live availability.`
}

function publicSuggestions(list: Event[], lead: string, to: string): ChatReply {
  if (!list.length) return { text: `${lead}\nThere are no matching future sample events marked available. You can adjust the filters on the events page.`, links: [{ label: 'Browse events', to }] }
  return {
    text: `${lead}\n${list.slice(0, 3).map((event) => `${event.title.en} — ${dayTime(event.date)} (Egypt time), ${event.venue.en}. ${money(event.price)}.`).join('\n')}\nThese are fictional sample suggestions, not live availability or recommendations based on your account.`,
    links: [...list.slice(0, 3).map(eventLink), { label: 'Browse matching events', to }],
  }
}

// Pure so tests can fix the clock without touching real account or browser state.
export function getDemoReply(message: string, now = Date.now()): ChatReply {
  const query = message.trim().toLowerCase().replace(/[’']/g, '')
  if (!query) return { text: 'Ask me in English about sample events, ticket selection, transfers, or refund policies.' }
  if (/[\u0600-\u06ff]/.test(query)) return { text: 'I can answer in English in this demo. Please ask your question in English, for example: “Find music events” or “How do transfers work?” The website interface still supports Arabic.' }

  // Specific personal-data requests are never answered by reading local state.
  const privateRequest = /\b(my|our)\s+(orders?|bookings?|tickets?|accounts?|emails?|passwords?|payments?|balance|profile|purchases?|refunds?|transfers?|history|qr)\b/.test(query)
  const asksForRecord = /\b(show|find|list|check|tell|read|give|where|what|when|who|status|number|details|balance|paid|have|bought|own)\b/.test(query)
  const genericHow = /\b(how|can i|where can i|where do i|policy|policies|rules|steps)\b/.test(query)
  const credentialRequest = /\b(password|token|secret|credential|session|credit card number|card details|cvv|email address)\b/.test(query)
  if (credentialRequest || privateRequest && asksForRecord && !genericHow || /\b(demo-[a-z0-9]|order (reference|id)|ticket (reference|id))\b/.test(query)) {
    return { text: 'I cannot access account details, purchased tickets, payment information, order status, or private records. Please use My Tickets for your ticket records or My account for account settings. This demo only answers from the public sample catalogue and general policies.', links: [{ label: 'My Tickets', to: '/my-tickets' }, { label: 'My account', to: '/profile' }] }
  }
  if (/\b(ignore|override|bypass)\b.*\b(instructions|rules|policy|system)\b|\b(system prompt|write code|javascript|python|programming|politics|president|medical|diagnos|investment)\b/.test(query)) return fallback()

  // Match a named event before general discovery words such as music or price.
  const namedEvent = events.find((event) => query.includes(event.title.en.toLowerCase().replace(/[’']/g, '')) || query.includes(event.id.replaceAll('-', ' ')) || query.includes(event.id))
  if (namedEvent) {
    const details = getEventDetails(namedEvent)
    let extra = ''
    if (/\b(refund|refunds|cancel|cancellation)\b/.test(query)) extra = `\n\n${details.policies[2].body.en}\n${refundHelp}`
    else if (/\b(transfer|transfers)\b/.test(query)) extra = `\n\n${transferHelp}`
    else if (/\b(door|doors|arriv|duration|long)\b/.test(query)) extra = `\n\nDoors open ${dayTime(details.doorsOpen)} (Egypt time), 30 minutes before the start. Sample duration: ${details.duration} minutes.`
    else if (/\b(age|child|children|family|id|admission)\b/.test(query)) extra = `\n\n${details.policies[0].body.en}`
    else if (/\b(access|accessible|accessibility|wheelchair)\b/.test(query)) extra = `\n\n${details.policies[3].body.en}`
    else if (/\b(food|drink|refreshment|refreshments)\b/.test(query)) extra = `\n\n${details.faqs[2].answer.en}`
    else if (/\b(address|map|location|where)\b/.test(query)) extra = `\n\n${details.address.en}. The venue is fictional; the map shows an approximate city location.`
    else if (/\b(buy|book|booking|select|tickets)\b/.test(query)) extra = `\n\n${namedEvent.status === 'available' && Date.parse(namedEvent.date) > now ? buyHelp : 'Ticket selection is unavailable for this sample event status or start time. Browse another upcoming sample event.'}`
    return { text: describeEvent(namedEvent, now) + extra, links: [eventLink(namedEvent)] }
  }

  if (/\b(refund|refunds|refundable)\b/.test(query)) return { text: refundHelp, links: [{ label: 'My Tickets', to: '/my-tickets' }] }
  if (/\b(transfer|transfers)\b/.test(query)) return { text: transferHelp, links: [{ label: 'My Tickets', to: '/my-tickets' }] }
  if (/\b(my tickets|qr|confirmation|ticket details|ticket email|resend)\b/.test(query)) return { text: 'Open My Tickets in the navigation, then open a ticket to see its attendee, timing, venue, order details, and demonstration QR code. Active sample tickets are fictional and their codes are not valid for admission. Ticket email actions show sample feedback only; they do not send email.', links: [{ label: 'My Tickets', to: '/my-tickets' }] }
  if (/\b(buy|book|booking|seat|seats|standing|checkout|cart|payment|pay|select tickets)\b/.test(query)) return { text: buyHelp, links: [{ label: 'Browse events', to: '/events' }, { label: 'Open cart', to: '/cart' }] }
  if (/\b(fee|fees|service charge)\b/.test(query)) return { text: 'Sample ticket service fees vary by ticket category: 10% for the front category, 8% for the middle category, and 12% for the rear category. The cart shows each ticket price, fee, and total before checkout. An event card shows its starting admission price before category fees. Free admission has no price-based service fee.', links: [{ label: 'Browse events', to: '/events' }] }
  if (/\b(human|agent|support|contact|help desk|complaint)\b/.test(query)) return { text: 'For a real event, contact its organiser using their verified event information. Open the relevant event details page and check the organiser and policies. This demo has fictional organiser information and no live support connection, so it cannot open a support case or send a message.', links: [{ label: 'Find your event', to: '/events' }] }
  if (/\b(sign in|log in|login|sign up|register|account settings|change email|change password)\b/.test(query)) return { text: 'Use Sign in for an existing account or Sign up to create one. My account opens your profile and settings. This chat cannot sign you in or view or change account details.', links: [{ label: 'Sign in', to: '/login' }, { label: 'Create account', to: '/register' }, { label: 'My account', to: '/profile' }] }

  const category = categories.find((item) => item.words.test(query))
  const city = cities.find((name) => new RegExp(`\\b${name}\\b`).test(query))
  const free = /\b(free|no cost|zero cost)\b/.test(query)
  const paid = !free && /\b(paid)\b/.test(query)
  const dateOnly = query.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
  if (dateOnly && (Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`)) || new Date(`${dateOnly}T00:00:00Z`).toISOString().slice(0, 10) !== dateOnly)) return { text: 'That date is not valid. Please use a date such as 2026-11-06, or browse the event filters.', links: [{ label: 'Browse events', to: '/events' }] }
  if (category || city || free || paid || dateOnly || /\b(events?|recommend|recommendation|recommendations|interests?|upcoming|trending|venues?|prices?|costs?|dates?|discover|something to do)\b/.test(query)) {
    const params = new URLSearchParams()
    if (category) params.set('category', category.id)
    if (city) params.set('city', city)
    if (free || paid) params.set('price', free ? 'free' : 'paid')
    if (dateOnly) params.set('date', dateOnly)
    const matches = events.filter((event) => event.status === 'available' && Date.parse(event.date) > now && (!category || event.category === category.id) && (!city || event.city === city) && (!free || event.price === 0) && (!paid || event.price > 0) && (!dateOnly || event.date.slice(0, 10) === dateOnly)).sort((a, b) => a.date.localeCompare(b.date))
    const criteria = [free ? 'free' : paid ? 'paid' : '', category?.label.toLowerCase() ?? '', city ? `in ${city[0].toUpperCase()}${city.slice(1)}` : '', dateOnly ? `on ${dateOnly}` : ''].filter(Boolean).join(' ')
    return publicSuggestions(matches, criteria ? `Here are upcoming ${criteria} sample events.` : 'Here are upcoming sample events and their venues.', `/events${params.size ? `?${params}` : ''}`)
  }
  if (/^(hi|hello|hey|thanks|thank you|help)[!.?\s]*$/.test(query)) return { text: 'I can help you explore sample events, compare starting prices, choose tickets, or understand transfers and refunds. Try “Find music events in Cairo” or “How do refunds work?”', links: [{ label: 'Explore events', to: '/events' }] }
  return fallback()
}

function fallback(): ChatReply {
  return { text: 'I can only help with Hafletna’s public sample events and general booking, transfer, and refund guidance. Try an event name, “Find free events”, or “How do I choose tickets?” For event-specific help, open its details and check the organiser and policies. This demo has no live support service.', links: [{ label: 'Browse events', to: '/events' }] }
}

export const demoChatReply: ChatSend = (message, signal) => new Promise<ChatReply>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Request cancelled', 'AbortError')); return }
  const abort = () => { clearTimeout(timer); reject(new DOMException('Request cancelled', 'AbortError')) }
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', abort)
    if (signal.aborted) { reject(new DOMException('Request cancelled', 'AbortError')); return }
    resolve(getDemoReply(message))
  }, 650)
  signal.addEventListener('abort', abort, { once: true })
})
