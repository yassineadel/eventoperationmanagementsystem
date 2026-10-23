// Events for the admin console.
//
// The admin console runs on sample data until its endpoints are wired: eight events across the
// sample venues, shaped like the admin list and the Prisma Event model. Adding, editing,
// publishing, cancelling and deleting change the sample data in memory until the page
// reloads. When the console moves to the API, replace the bodies of `adminEventsApi.*`
// with calls from './api'.

import type { Category } from '../Components/Homepage/types'
import { AdminApiError } from './adminErrors.ts'
import { minutesAfter, now, toWall } from './adminTime.ts'
import { ordersApi, type Localized } from './ordersApi.ts'
import { venuesApi, type Venue } from './venuesApi.ts'

export type EventStatus = 'draft' | 'published' | 'cancelled'

export type AdminEvent = {
  id: string
  name: string
  category: Category
  performer: string
  description: string
  status: EventStatus
  /** Started before "now"; past events stay listed for the admin (FR-ADM-10). */
  isPast: boolean
  startAt: string
  doorsOpenAt: string
  durationMinutes: number
  salesOpenAt?: string
  salesCloseAt?: string
  createdAt: string
  publishedAt?: string
  cancelledAt?: string
  cancellationReason?: Localized
  venueId: string
  venue: string
  city: string
  /** Tickets sold and places on sale, summed over the ticket categories. */
  sold: number
  capacity: number
}

/**
 * A price phase inside a ticket category, e.g. "Early bird · 500 EGP × 50".
 * Waves sell in order: the next one opens automatically when the one before it sells out.
 */
export type Wave = { id: string; name: string; price: number; capacity: number; sold: number }

export type WaveState = 'sold-out' | 'on-sale' | 'upcoming'

/** A ticket category; capacity, sold and the current price come from its waves. */
export type EventCategory = { key: string; name: string; waves: Wave[]; price: number; capacity: number; sold: number }

/** What the tickets editor works with. A wave without an id is new. */
export type CategoryForm = { key: string; name: string; waves: Array<Omit<Wave, 'id'> & { id?: string }> }

/** Which wave is on sale: the first one that still has places; every earlier one is sold out. */
export function waveStates(waves: Pick<Wave, 'capacity' | 'sold'>[]): WaveState[] {
  const current = waves.findIndex((w) => w.sold < w.capacity)
  return waves.map((_, i) => (current < 0 || i < current ? 'sold-out' : i === current ? 'on-sale' : 'upcoming'))
}

function summarise(key: string, name: string, waves: Wave[]): EventCategory {
  const states = waveStates(waves)
  const current = waves[states.indexOf('on-sale')] ?? waves[waves.length - 1]
  return {
    key,
    name,
    waves,
    price: current?.price ?? 0,
    capacity: waves.reduce((n, w) => n + w.capacity, 0),
    sold: waves.reduce((n, w) => n + w.sold, 0),
  }
}

export type EventDetail = { event: AdminEvent; categories: EventCategory[] }

/** What the add / edit form works with. Dates are "YYYY-MM-DDTHH:mm" like a datetime-local input. */
export type EventForm = {
  name: string
  category: Category
  performer: string
  description: string
  venueId: string
  startAt: string
  doorsOpenAt: string
  durationMinutes: number
  salesOpenAt: string
  salesCloseAt: string
}

export const EVENT_CATEGORIES: Category[] = ['concerts', 'festivals', 'arts', 'sports', 'workshops', 'conferences']

/* ----------------------------------------------------------- sample data */

type Seed = Omit<AdminEvent, 'isPast' | 'sold' | 'capacity' | 'doorsOpenAt'> & { doorsBefore?: number }

const VENUES = {
  nile: { venueId: '7c1e4b2a-91d3-4f0e-a6b5-2d8f3c9e1a07', venue: 'Nile Arena', city: 'Cairo' },
  riverfront: { venueId: 'b84f0c6d-3e2a-47b9-8d15-6a0e9f4c2b31', venue: 'Riverfront Stage', city: 'Giza' },
  downtown: { venueId: '3a9d7e15-c2f8-4b60-9e4a-81b5d0f6c7e2', venue: 'Downtown Hall', city: 'Cairo' },
  garden: { venueId: 'e2c5a8f1-6b4d-4d7e-b0a3-9f1c8e2d5b46', venue: 'Garden Amphitheater', city: 'Giza' },
  seafront: { venueId: '58b1f9d0-a7e3-4c2b-96f8-0d4e7a1c3b95', venue: 'Seafront Theatre', city: 'Alexandria' },
  redSea: { venueId: 'c6f3e0b7-2d9a-4e81-a5c4-7b0f2e9d8a13', venue: 'Red Sea Open Air', city: 'Hurghada' },
}

const SEEDS: Seed[] = [
  {
    id: '4f2a9c1e-7b3d-4e8a-9c21-5d6e7f8a9b01',
    name: 'Cairo Jazz Night',
    category: 'concerts',
    performer: 'Cairo Jazz Collective',
    description: 'An evening of classic and modern jazz with the Cairo Jazz Collective and guest soloists.',
    status: 'published',
    startAt: '2026-10-24T20:00',
    durationMinutes: 150,
    salesOpenAt: '2026-09-20T10:00',
    salesCloseAt: '2026-10-24T18:00',
    createdAt: '2026-09-12T11:20',
    publishedAt: '2026-09-18T09:00',
    ...VENUES.nile,
  },
  {
    id: '8b3c0d2f-1a4e-4b9c-8d32-6e7f8a9b0c12',
    name: 'Sunset Beats',
    category: 'festivals',
    performer: 'DJ Nour & friends',
    description: 'Open-air electronic music on the Nile from sunset until late.',
    status: 'published',
    startAt: '2026-10-31T17:00',
    durationMinutes: 300,
    salesOpenAt: '2026-09-25T12:00',
    createdAt: '2026-09-15T14:05',
    publishedAt: '2026-09-24T16:30',
    ...VENUES.riverfront,
  },
  {
    id: 'c5d1e3a0-2b5f-4c0d-9e43-7f8a9b0c1d23',
    name: 'Stand-Up Friday',
    category: 'arts',
    performer: 'Ahmed Amin',
    description: 'A night of Arabic and English stand-up comedy with four comedians.',
    status: 'published',
    startAt: '2026-10-16T21:00',
    durationMinutes: 120,
    createdAt: '2026-09-01T10:00',
    publishedAt: '2026-09-03T12:00',
    ...VENUES.downtown,
  },
  {
    id: 'd6e2f4b1-3c6a-4d1e-8f54-8a9b0c1d2e34',
    name: 'Acoustic Nights',
    category: 'concerts',
    performer: 'Massar Egbari Unplugged',
    description: 'Stripped-back acoustic sets under the trees of the amphitheater.',
    status: 'published',
    startAt: '2026-11-14T18:30',
    durationMinutes: 180,
    salesOpenAt: '2026-10-01T10:00',
    salesCloseAt: '2026-11-14T16:00',
    createdAt: '2026-09-22T09:45',
    publishedAt: '2026-09-30T18:00',
    ...VENUES.garden,
  },
  {
    id: 'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45',
    name: 'Red Sea Beach Run',
    category: 'sports',
    performer: '',
    description: 'A 10 km sunrise run along the Hurghada coast, with a family 3 km route.',
    status: 'cancelled',
    startAt: '2026-11-21T07:00',
    durationMinutes: 180,
    createdAt: '2026-08-28T13:10',
    publishedAt: '2026-09-02T10:00',
    cancelledAt: '2026-10-08T15:40',
    cancellationReason: {
      en: 'The city did not renew the permit for the coastal road, so the run was cancelled and every ticket refunded.',
      ar: 'لم تجدد المدينة تصريح الطريق الساحلي، فأُلغي السباق واستُردت قيمة كل التذاكر.',
    },
    ...VENUES.redSea,
  },
  {
    id: 'f8a4b6d3-5e8c-4f3a-8b76-0c1d2e3f4a56',
    name: 'Alexandria Film Week',
    category: 'arts',
    performer: '',
    description: 'Five evenings of Mediterranean short films with talks from the directors.',
    status: 'draft',
    startAt: '2026-12-05T19:00',
    durationMinutes: 180,
    createdAt: '2026-10-14T16:25',
    ...VENUES.seafront,
  },
  {
    id: '0a9b7c4e-6f9d-4a4b-9c87-1d2e3f4a5b67',
    name: 'Startup Summit Cairo',
    category: 'conferences',
    performer: '',
    description: 'Talks and workshops for founders, with a pitch competition in the afternoon.',
    status: 'draft',
    startAt: '2026-12-12T09:00',
    durationMinutes: 480,
    doorsBefore: 90,
    createdAt: '2026-10-17T10:40',
    ...VENUES.downtown,
  },
  {
    id: '1b0c8d5f-7a0e-4b5c-8d98-2e3f4a5b6c78',
    name: 'Pottery by the Nile',
    category: 'workshops',
    performer: 'Tunis Village Potters',
    description: 'A hands-on pottery workshop for beginners; clay and tools included.',
    status: 'draft',
    startAt: '2026-11-07T11:00',
    durationMinutes: 150,
    doorsBefore: 30,
    createdAt: '2026-10-18T12:15',
    ...VENUES.garden,
  },
]

let waveCount = 0
const wave = (name: string, price: number, capacity: number, sold: number): Wave => ({ id: `w${++waveCount}`, name, price, capacity, sold })
const cat = (key: string, name: string, ...waves: Wave[]) => summarise(key, name, waves)
const single = (key: string, name: string, price: number, capacity: number, sold: number) => cat(key, name, wave('Regular', price, capacity, sold))

let CATEGORIES: Record<string, EventCategory[]> = {
  [SEEDS[0].id]: [
    cat('VIP', 'VIP', wave('Early bird', 1000, 20, 20), wave('Regular', 1500, 22, 18)),
    cat('PREMIUM', 'Premium', wave('Early bird', 600, 30, 30), wave('Regular', 900, 40, 21)),
    single('STANDARD', 'Standard', 500, 96, 40),
    single('BALCONY', 'Balcony', 350, 78, 12),
  ],
  [SEEDS[1].id]: [
    cat('FRONT', 'Front standing', wave('Wave 1', 600, 100, 100), wave('Wave 2', 900, 200, 114)),
    cat('GA', 'General admission', wave('Wave 1', 350, 300, 300), wave('Wave 2', 450, 300, 88), wave('Final wave', 600, 300, 0)),
  ],
  [SEEDS[2].id]: [single('VIP', 'VIP', 700, 48, 48), single('STANDARD', 'Standard', 400, 120, 117)],
  [SEEDS[3].id]: [single('GOLD', 'Gold circle', 750, 200, 64), cat('GENERAL', 'General', wave('Early bird', 300, 150, 150), wave('Regular', 400, 550, 32))],
  [SEEDS[4].id]: [single('PIT', '10 km', 450, 500, 0), single('GA', '3 km family', 200, 1400, 0)],
  [SEEDS[5].id]: [single('STANDARD', 'Festival pass', 600, 300, 0)],
  [SEEDS[6].id]: [],
  [SEEDS[7].id]: [cat('GENERAL', 'Workshop seat', wave('Early bird', 250, 15, 0), wave('Regular', 350, 25, 0))],
}

function withTotals(seed: Seed | AdminEvent): AdminEvent {
  const cats = CATEGORIES[seed.id] ?? []
  const { doorsBefore, ...rest } = seed as Seed
  return {
    ...rest,
    doorsOpenAt: 'doorsOpenAt' in seed && seed.doorsOpenAt ? seed.doorsOpenAt : minutesAfter(seed.startAt, -(doorsBefore ?? 60)),
    isPast: seed.startAt < now(),
    sold: cats.reduce((n, c) => n + c.sold, 0),
    capacity: cats.reduce((n, c) => n + c.capacity, 0),
  }
}

let EVENTS: AdminEvent[] = SEEDS.map(withTotals)

/** Published, not started, and inside its sales window (FR-ADM-11). */
export function isOnSale(e: Pick<AdminEvent, 'status' | 'startAt' | 'salesOpenAt' | 'salesCloseAt'>, at = now()) {
  return e.status === 'published' && e.startAt > at && (!e.salesOpenAt || e.salesOpenAt <= at) && (!e.salesCloseAt || e.salesCloseAt >= at)
}

/* ------------------------------------------------------------------- api */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class EventNotFoundError extends Error {
  constructor() {
    super('Event not found')
    this.name = 'EventNotFoundError'
  }
}

function find(id: string) {
  const event = EVENTS.find((e) => e.id === id)
  if (!event) throw new EventNotFoundError()
  return event
}

function replace(event: AdminEvent) {
  const next = withTotals(event)
  EVENTS = EVENTS.map((e) => (e.id === event.id ? next : e))
  return next
}

/** Recomputes "past" against the clock and reads the venue's current name, so renames show everywhere. */
function present(e: AdminEvent, venues: Venue[]): AdminEvent {
  const venue = venues.find((v) => v.id === e.venueId)
  return { ...withTotals(e), ...(venue && { venue: venue.name, city: venue.city }) }
}

function sampleId(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0')
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(5, 8)}-b${hex.slice(1, 4)}-${hex}${hex.slice(0, 4)}`
}

async function venueFields(venueId: string) {
  const venue = (await venuesApi.list()).find((v) => v.id === venueId)
  if (!venue) throw new AdminApiError('venue-missing')
  return { venueId: venue.id, venue: venue.name, city: venue.city }
}

function fromForm(form: EventForm) {
  return {
    name: form.name.trim(),
    category: form.category,
    performer: form.performer.trim(),
    description: form.description.trim(),
    startAt: form.startAt,
    doorsOpenAt: form.doorsOpenAt,
    durationMinutes: form.durationMinutes,
    salesOpenAt: form.salesOpenAt || undefined,
    salesCloseAt: form.salesCloseAt || undefined,
  }
}

// Deleted drafts are kept here so "Undo" can put them back where they were.
const TRASH = new Map<string, { event: AdminEvent; categories: EventCategory[]; index: number }>()

export const adminEventsApi = {
  async list(): Promise<AdminEvent[]> {
    const venues = await venuesApi.list()
    return EVENTS.map((e) => present(e, venues))
  },
  async get(id: string): Promise<EventDetail> {
    const venues = await venuesApi.list()
    const event = find(id)
    return { event: present(event, venues), categories: CATEGORIES[id] ?? [] }
  },
  /** How many events use a venue; a venue with events can't be deleted. */
  async countAtVenue(venueId: string): Promise<number> {
    return EVENTS.filter((e) => e.venueId === venueId).length
  },
  async getForm(id: string): Promise<{ form: EventForm; status: EventStatus; name: string }> {
    await delay(250)
    const e = find(id)
    const form: EventForm = {
      name: e.name,
      category: e.category,
      performer: e.performer,
      description: e.description,
      venueId: e.venueId,
      startAt: toWall(e.startAt) ?? '',
      doorsOpenAt: toWall(e.doorsOpenAt) ?? '',
      durationMinutes: e.durationMinutes,
      salesOpenAt: toWall(e.salesOpenAt) ?? '',
      salesCloseAt: toWall(e.salesCloseAt) ?? '',
    }
    return { form, status: e.status, name: e.name }
  },
  /** New events always start as drafts, like POST /api/events. */
  async create(form: EventForm): Promise<AdminEvent> {
    await delay(400)
    const id = sampleId(`${form.name}:${Date.now()}`)
    const event = withTotals({
      id,
      ...fromForm(form),
      ...(await venueFields(form.venueId)),
      status: 'draft',
      createdAt: now(),
    } as AdminEvent)
    CATEGORIES = { ...CATEGORIES, [id]: [] }
    EVENTS = [event, ...EVENTS]
    return event
  },
  /** Descriptive fields stay editable after publishing; the venue does not (FR-ADM-09). */
  async update(id: string, form: EventForm): Promise<AdminEvent> {
    await delay(400)
    const event = find(id)
    if (event.status !== 'draft' && form.venueId !== event.venueId) throw new AdminApiError('venue-locked')
    return replace({ ...event, ...fromForm(form), ...(await venueFields(form.venueId)) })
  },
  async publish(id: string): Promise<EventDetail> {
    await delay(400)
    const event = find(id)
    if (event.status !== 'draft') throw new AdminApiError('draft-only-publish')
    return { event: replace({ ...event, status: 'published', publishedAt: now() }), categories: CATEGORIES[id] ?? [] }
  },
  /**
   * Published events are cancelled, never deleted, and kept for analysis (FR-ADM-12, BR-19).
   * Every ticket is refunded in full and pending orders are cancelled.
   */
  async cancel(id: string, reason: string, actor = 'Admin'): Promise<EventDetail> {
    await delay(500)
    const event = find(id)
    if (event.status !== 'published') throw new AdminApiError('published-only-cancel')
    const text = reason.trim()
    await ordersApi.cancelEvent(id, text, actor)
    return {
      event: replace({ ...event, status: 'cancelled', cancelledAt: now(), cancellationReason: { en: text, ar: text } }),
      categories: CATEGORIES[id] ?? [],
    }
  },
  /**
   * Replace an event's ticket categories and waves. Tickets already sold stay where they are:
   * a wave that has sales keeps its price and can't shrink below what it sold, and a
   * category with sales can't be removed.
   */
  async saveCategories(id: string, forms: CategoryForm[]): Promise<EventDetail> {
    await delay(450)
    const event = find(id)
    if (event.status === 'cancelled' || event.startAt < now()) throw new AdminApiError('tickets-locked')
    const before = CATEGORIES[id] ?? []
    const oldWaves = new Map(before.flatMap((c) => c.waves.map((w) => [w.id, w] as const)))
    for (const c of before) {
      if (c.sold > 0 && !forms.some((f) => f.key === c.key)) throw new AdminApiError('category-has-sales')
    }
    const next = forms.map((f) => {
      const waves = f.waves.map((w) => {
        const old = w.id ? oldWaves.get(w.id) : undefined
        const sold = old?.sold ?? 0
        if (old && sold > 0 && w.price !== old.price) throw new AdminApiError('wave-price-locked')
        if (w.capacity < Math.max(1, sold)) throw new AdminApiError('wave-below-sold')
        return { id: old?.id ?? `w${++waveCount}`, name: w.name.trim(), price: w.price, capacity: w.capacity, sold }
      })
      for (const old of before.find((c) => c.key === f.key)?.waves ?? []) {
        if (old.sold > 0 && !waves.some((w) => w.id === old.id)) throw new AdminApiError('wave-has-sales')
      }
      return summarise(f.key.trim().toUpperCase(), f.name.trim(), waves)
    })
    CATEGORIES = { ...CATEGORIES, [id]: next }
    return { event: replace(event), categories: next }
  },
  /** Only drafts can be deleted. */
  async remove(id: string): Promise<AdminEvent> {
    await delay(300)
    const index = EVENTS.findIndex((e) => e.id === id)
    if (index < 0) throw new EventNotFoundError()
    const event = EVENTS[index]
    if (event.status !== 'draft') throw new AdminApiError('draft-only-delete')
    TRASH.set(id, { event, categories: CATEGORIES[id] ?? [], index })
    EVENTS = EVENTS.filter((e) => e.id !== id)
    return event
  },
  async restore(id: string): Promise<AdminEvent> {
    await delay(200)
    const item = TRASH.get(id)
    if (!item) throw new EventNotFoundError()
    TRASH.delete(id)
    CATEGORIES = { ...CATEGORIES, [id]: item.categories }
    EVENTS = [...EVENTS.slice(0, item.index), item.event, ...EVENTS.slice(item.index)]
    return item.event
  },
}
