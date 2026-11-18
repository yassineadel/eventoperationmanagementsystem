/**
 * Functions the chat model may call.
 * - Public ones read events and venues; anyone can use them.
 * - Account ones read the signed-in user's own tickets, orders and refunds. They are only offered
 *   when the user is signed in, and they take no user id: the id comes from the login, so the
 *   model cannot reach anyone else's account.
 * None of them changes anything.
 */
import type { ToolDeclaration, ToolRunner } from '../llm'
import { EVENT_CATEGORIES, eventFacts, recommendEvents, searchEvents, venueDetails, type EventSearch } from './event-facts'
import { myOrders, myRefundQuote, myRefunds, myTickets } from './my-account'
import { ADMIN_TOOL_NAMES, adminTools, runAdminTool, type AdminSeen } from './admin-tools'

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const text = (v: unknown, max = 100) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What the functions showed the model, so the reply can link to it */
export type ToolContext = {
  /** event id → name for every event a function returned */
  events: Map<string, string>
  /** true once the user's own tickets, orders or refunds were read */
  usedAccount: boolean
  /** what the admin functions returned (administrators only) */
  admin: AdminSeen
  /** names of the functions the model called, for the mood statistics' topic */
  used: Set<string>
}

export const newToolContext = (events: Map<string, string> = new Map()): ToolContext => ({
  events,
  usedAccount: false,
  admin: { events: new Map(), orders: new Map(), customers: new Map(), usedRefunds: false },
  used: new Set(),
})

const publicTools: ToolDeclaration[] = [
  {
    name: 'search_events',
    description:
      'Finds upcoming events by exact filters: words in the name, performer or venue, category, city, date range, ' +
      'free only, maximum price, and sort order. Use it for "concerts in Cairo this weekend", "free workshops", ' +
      '"something under 300 EGP", "what is popular", or an event the user names. Returns at most 6 events.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for in the event name, performer or venue, e.g. "jazz" or "Opera House". Keep it short.' },
        category: { type: 'string', enum: [...EVENT_CATEGORIES] },
        city: { type: 'string', description: 'City in English, e.g. "Cairo", "Alexandria", "Giza"' },
        date_from: { type: 'string', description: 'First day, YYYY-MM-DD, inclusive' },
        date_to: { type: 'string', description: 'Last day, YYYY-MM-DD, inclusive' },
        free_only: { type: 'boolean', description: 'Only events where every ticket is free' },
        max_price: { type: 'number', description: 'Highest acceptable price of the cheapest ticket, in EGP, before service fee' },
        sort: { type: 'string', enum: ['soonest', 'cheapest', 'popular'] },
      },
    },
  },
  {
    name: 'recommend_events',
    description:
      'Suggests upcoming events that fit a wish described in words, by matching event descriptions by meaning: ' +
      'a mood, style, genre or audience such as "loud techno", "something romantic", "good for kids", "relaxing", ' +
      '"learn something new". Use it for recommendations that are not simple filters. Returns up to 5 events, best fit first.',
    parameters: {
      type: 'object',
      properties: {
        wish: { type: 'string', description: 'What the user is looking for, in English, e.g. "energetic electronic dance music night"' },
        city: { type: 'string', description: 'City in English, if the user gave one' },
        date_from: { type: 'string', description: 'First day, YYYY-MM-DD, if the user gave dates' },
        date_to: { type: 'string', description: 'Last day, YYYY-MM-DD, if the user gave dates' },
      },
      required: ['wish'],
    },
  },
  {
    name: 'get_event_details',
    description:
      'Gets the live details of one event by its event_id: status, date, doors and start time, duration, venue and address, ' +
      'and every ticket type with price, service fee, total and places left. Use it for an event that is not already in ' +
      'LIVE EVENT DETAILS, with an event_id from another function.',
    parameters: {
      type: 'object',
      properties: { event_id: { type: 'string', description: 'The event_id from another function or from LIVE EVENT DETAILS' } },
      required: ['event_id'],
    },
  },
  {
    name: 'get_venue_details',
    description:
      'Finds a venue by (part of) its name and gives its address, city, capacity, whether it is seated or standing, ' +
      'a Google Maps link, and its upcoming events. Use it for "where is the venue", "how many people fit", ' +
      '"what is on at the Opera House".',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Venue name or part of it, e.g. "Opera House"' } },
      required: ['name'],
    },
  },
]

const accountTools: ToolDeclaration[] = [
  {
    name: 'get_my_tickets',
    description:
      "Lists the signed-in user's own tickets: upcoming and recent past, with event, date, venue, status, ticket type, seat, " +
      'attendee name, order reference, transfers left and refund status. Use it for "my tickets", "when is my event", ' +
      '"what seat do I have", "can I still transfer it".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_orders',
    description:
      "Lists the signed-in user's own recent orders with reference, event, status (paid, waiting for payment, failed, cancelled), " +
      'number of tickets and total. Use it for "did my payment go through", "my order", "order HF-…".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_refunds',
    description:
      "Lists the signed-in user's own refunds with status, amount and the administrator's message. Use it for " +
      '"what happened to my refund", "was my refund approved".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_refund',
    description:
      "Checks whether one of the signed-in user's tickets can be refunded now, why not if it cannot, and exactly how much " +
      'they would get back. Needs a ticket_id from get_my_tickets. It only checks; it does not request the refund.',
    parameters: {
      type: 'object',
      properties: { ticket_id: { type: 'string', description: 'The ticket_id from get_my_tickets' } },
      required: ['ticket_id'],
    },
  },
]

/** The functions offered for this question: account functions to customers, admin functions to administrators */
export const chatToolsFor = (asker: 'customer' | 'admin' | 'visitor'): ToolDeclaration[] =>
  asker === 'customer' ? [...publicTools, ...accountTools] : asker === 'admin' ? [...publicTools, ...adminTools] : publicTools

/**
 * Runs the chat model's function calls. `userId` is the signed-in customer and `isAdmin` whether an
 * administrator is asking, both from the login; account and admin functions refuse otherwise, even
 * if the model calls them. Everything returned is recorded in `context` for the reply's links.
 */
export const runChatTool = (context: ToolContext, userId?: string, isAdmin = false): ToolRunner => async ({ name, args }) => {
  context.used.add(name)
  const remember = (events: { event_id: string; name?: string; event?: string }[]) => {
    for (const e of events) context.events.set(e.event_id, (e.name ?? e.event)!)
  }

  switch (name) {
    case 'search_events': {
      const search: EventSearch = {
        query: text(args.query),
        category: EVENT_CATEGORIES.find((c) => c === args.category),
        city: text(args.city),
        dateFrom: isDay(args.date_from) ? args.date_from : undefined,
        dateTo: isDay(args.date_to) ? args.date_to : undefined,
        freeOnly: args.free_only === true,
        maxPrice: typeof args.max_price === 'number' && args.max_price >= 0 ? args.max_price : undefined,
        sort: args.sort === 'cheapest' || args.sort === 'popular' || args.sort === 'soonest' ? args.sort : undefined,
      }
      const result = await searchEvents(search)
      remember(result.events)
      return result
    }
    case 'recommend_events': {
      const wish = text(args.wish, 300)
      if (!wish) return { error: 'Describe what the user is looking for in wish' }
      const result = await recommendEvents({
        wish,
        city: text(args.city),
        dateFrom: isDay(args.date_from) ? args.date_from : undefined,
        dateTo: isDay(args.date_to) ? args.date_to : undefined,
      })
      remember(result.events)
      return result.events.length ? result : { events: [], note: 'No upcoming event fits that wish.' }
    }
    case 'get_event_details': {
      const id = typeof args.event_id === 'string' ? args.event_id.trim() : ''
      if (!UUID.test(id)) return { error: 'event_id must be an id returned by another function' }
      const [facts] = await eventFacts([id])
      if (!facts) return { error: 'No such event' }
      context.events.set(facts.id, facts.name)
      return { details: facts.text }
    }
    case 'get_venue_details': {
      const venueName = text(args.name)
      if (!venueName) return { error: 'Give the venue name' }
      const result = await venueDetails(venueName)
      for (const v of result.venues) remember(v.upcoming_events)
      return result.venues.length ? result : { venues: [], note: 'No venue has that name.' }
    }
  }

  if (ADMIN_TOOL_NAMES.has(name)) {
    if (!isAdmin) return { error: 'Only administrators can use this.' }
    return runAdminTool(name, args, context.admin)
  }

  // Account functions: only for the signed-in user, and only ever their own account
  if (['get_my_tickets', 'get_my_orders', 'get_my_refunds', 'check_refund'].includes(name)) {
    if (!userId) return { error: 'The user is not signed in. Ask them to sign in to see their own tickets, orders and refunds.' }
    context.usedAccount = true
    if (name === 'get_my_tickets') {
      const result = await myTickets(userId)
      remember([...result.upcoming, ...result.past])
      return result
    }
    if (name === 'get_my_orders') {
      const result = await myOrders(userId)
      remember(result.orders)
      return result
    }
    if (name === 'get_my_refunds') return myRefunds(userId)
    const ticketId = typeof args.ticket_id === 'string' ? args.ticket_id.trim() : ''
    if (!UUID.test(ticketId)) return { error: 'ticket_id must be an id from get_my_tickets' }
    try {
      return await myRefundQuote(userId, ticketId)
    } catch {
      return { error: 'That ticket is not among this user\'s tickets' }
    }
  }

  return { error: `Unknown function ${name}` }
}
