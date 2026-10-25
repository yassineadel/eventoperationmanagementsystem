// Status, validation and change rules for the admin events pages. Pure functions, so the
// tests in tests/admin.test.mjs can check them without a browser.
import { waveStates, type AdminEvent, type CategoryForm, type EventCategory, type EventForm, type Wave, type WaveState } from '../../lib/adminEventsApi.ts'
import type { EventsStrings } from './eventsStrings'

/** Colour of a status badge; reuses the order palette from Orders.css. */
export type Tone = 'paid' | 'pending' | 'refunded' | 'cancelled' | 'checked'

export type EventDisplayStatus = 'draft' | 'published' | 'past' | 'cancelled'

/** Published events that already started read as "past". */
export function displayStatus(e: Pick<AdminEvent, 'status' | 'isPast'>): EventDisplayStatus {
  return e.status === 'published' && e.isPast ? 'past' : e.status
}

export const EVENT_TONE: Record<EventDisplayStatus, Tone> = {
  draft: 'pending',
  published: 'paid',
  past: 'checked',
  cancelled: 'cancelled',
}

/** A wave as the admin sees it: nothing is on sale before publishing or after the event ends or is cancelled. */
export type WaveShown = WaveState | 'not-yet' | 'closed'

export function shownWaveStates(waves: Pick<Wave, 'capacity' | 'sold'>[], shown: EventDisplayStatus): WaveShown[] {
  const states = waveStates(waves)
  if (shown === 'published') return states
  return states.map((s) => (s === 'sold-out' ? s : shown === 'draft' ? 'not-yet' : 'closed'))
}

/** A sold-out wave reads like a checked-in ticket, the live one green, the next one amber. */
export const WAVE_TONE: Record<WaveShown, Tone> = { 'sold-out': 'checked', 'on-sale': 'paid', upcoming: 'pending', 'not-yet': 'pending', closed: 'checked' }

export function waveLabel(t: EventsStrings, state: WaveShown) {
  switch (state) {
    case 'sold-out':
      return t.soldOut
    case 'on-sale':
      return t.onSale
    case 'upcoming':
      return t.upcoming
    case 'not-yet':
      return t.notOnSaleYet
    case 'closed':
      return t.salesClosed
  }
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

/* ------------------------------------------------------------ event form */

export type EventProblem = 'name' | 'description' | 'venueId' | 'startAt' | 'startPast' | 'doorsOpenAt' | 'durationMinutes' | 'salesCloseAt'

/** Field each problem belongs to, for aria-invalid and focus. */
export const PROBLEM_FIELD: Record<EventProblem, keyof EventForm> = {
  name: 'name',
  description: 'description',
  venueId: 'venueId',
  startAt: 'startAt',
  startPast: 'startAt',
  doorsOpenAt: 'doorsOpenAt',
  durationMinutes: 'durationMinutes',
  salesCloseAt: 'salesCloseAt',
}

const ORDER: EventProblem[] = ['name', 'description', 'venueId', 'startAt', 'startPast', 'doorsOpenAt', 'durationMinutes', 'salesCloseAt']

/** Doors can open at most this many minutes before the start. */
export const MAX_DOORS_BEFORE = 12 * 60

const minutesBetween = (a: string, b: string) => (new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60_000

/** What stops the event form from saving, in the order the form shows it. New events must start in the future. */
export function eventFormProblems(form: EventForm, opts: { isNew: boolean; now: string }): EventProblem[] {
  const found = new Set<EventProblem>()
  if (!form.name.trim()) found.add('name')
  if (!form.description.trim()) found.add('description')
  if (!form.venueId) found.add('venueId')
  if (!form.startAt) found.add('startAt')
  else if (opts.isNew && form.startAt <= opts.now) found.add('startPast')
  if (!form.doorsOpenAt || (form.startAt && (form.doorsOpenAt > form.startAt || minutesBetween(form.doorsOpenAt, form.startAt) > MAX_DOORS_BEFORE))) {
    found.add('doorsOpenAt')
  }
  if (!(form.durationMinutes >= 1)) found.add('durationMinutes')
  const closesBy = form.salesCloseAt || form.startAt
  if ((form.salesOpenAt && closesBy && form.salesOpenAt >= closesBy) || (form.salesCloseAt && form.startAt && form.salesCloseAt > form.startAt)) {
    found.add('salesCloseAt')
  }
  return ORDER.filter((p) => found.has(p))
}

/* --------------------------------------------------------- ticket editor */

export type WaveProblem = 'name' | 'capacity'
export type CategoryProblems = { name: boolean; code: boolean; noWave: boolean; waves: Partial<Record<number, WaveProblem>> }

/** Problems per category and per wave, so each message sits next to its row. */
export function ticketProblems(forms: CategoryForm[]): CategoryProblems[] {
  const codes = forms.map((c) => c.key.trim().toUpperCase())
  return forms.map((c, i) => {
    const waves: CategoryProblems['waves'] = {}
    c.waves.forEach((w, k) => {
      if (!w.name.trim()) waves[k] = 'name'
      else if (w.capacity < Math.max(1, w.sold)) waves[k] = 'capacity'
    })
    return {
      name: !c.name.trim(),
      code: !codes[i] || codes.indexOf(codes[i]) !== i,
      noWave: c.waves.length === 0,
      waves,
    }
  })
}

export const hasTicketProblems = (problems: CategoryProblems[]) =>
  problems.some((p) => p.name || p.code || p.noWave || Object.keys(p.waves).length > 0)

/** A wave with no sales can move up or down, but never ahead of a wave that has sales. */
export function canMoveWave(waves: CategoryForm['waves'], from: number, to: number) {
  if (to < 0 || to >= waves.length || waves[from].sold > 0 || waves[to].sold > 0) return false
  const lastSold = waves.reduce((last, w, i) => (w.sold > 0 ? i : last), -1)
  return Math.min(from, to) > lastSold
}

export type WaveChange =
  | { kind: 'category-added' | 'category-removed'; category: string }
  | { kind: 'wave-added'; category: string; wave: string; price: number; capacity: number }
  | { kind: 'wave-removed'; category: string; wave: string }
  | { kind: 'price' | 'capacity'; category: string; wave: string; from: number; to: number }
  | { kind: 'on-sale'; category: string; from: string | null; to: string | null }

/** What saving would change, for the review step before editing a live event's tickets. */
export function waveChanges(before: EventCategory[], after: CategoryForm[]): WaveChange[] {
  const changes: WaveChange[] = []
  const onSale = (waves: Array<{ name: string; capacity: number; sold: number }>) => {
    const i = waveStates(waves).indexOf('on-sale')
    return i < 0 ? null : waves[i].name
  }
  for (const c of before) {
    if (!after.some((f) => f.key.trim().toUpperCase() === c.key)) changes.push({ kind: 'category-removed', category: c.name })
  }
  for (const f of after) {
    const old = before.find((c) => c.key === f.key.trim().toUpperCase())
    const name = f.name.trim() || f.key
    if (!old) {
      changes.push({ kind: 'category-added', category: name })
      continue
    }
    for (const w of old.waves) {
      if (!f.waves.some((x) => x.id === w.id)) changes.push({ kind: 'wave-removed', category: name, wave: w.name })
    }
    for (const w of f.waves) {
      const prev = w.id ? old.waves.find((x) => x.id === w.id) : undefined
      if (!prev) {
        changes.push({ kind: 'wave-added', category: name, wave: w.name, price: w.price, capacity: w.capacity })
        continue
      }
      if (prev.price !== w.price) changes.push({ kind: 'price', category: name, wave: w.name, from: prev.price, to: w.price })
      if (prev.capacity !== w.capacity) changes.push({ kind: 'capacity', category: name, wave: w.name, from: prev.capacity, to: w.capacity })
    }
    const was = onSale(old.waves)
    const will = onSale(f.waves)
    if (was !== will) changes.push({ kind: 'on-sale', category: name, from: was, to: will })
  }
  return changes
}
