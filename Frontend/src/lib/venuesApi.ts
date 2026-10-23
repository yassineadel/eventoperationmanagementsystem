// Venue data for the admin console.
//
// The admin console runs on sample data until its endpoints are wired: venues shaped
// like the venue layout described in the assignment: sections, rows and seats
// with IDs for seated venues, zone rectangles on a 0–100 grid for standing venues,
// the stage position and category colours. Adding, editing and deleting change the
// sample data in memory until the page reloads. When the API exists, replace the
// bodies of `venuesApi.*` with calls from './api'.

import { adminEventsApi } from './adminEventsApi.ts'
import { AdminApiError } from './adminErrors.ts'

export type VenueKind = 'seated' | 'standing'

export type Venue = {
  id: string
  name: string
  address: string
  city: string
  country: string
  totalCapacity: number
  kind: VenueKind
}

/** A rectangle on the venue's 0–100 coordinate grid. */
export type Rect = { x: number; y: number; w: number; h: number }

export type VenueCategory = {
  key: string
  name: string
  colour: string
  /** Where the category sits, e.g. "Orchestra · rows A–C" or a zone name. */
  area: string
  places: number
}

export type Seat = { id: string; number: number; categoryKey: string }
export type SeatRow = { label: string; seats: Seat[] }
export type SeatSection = { id: string; name: string; tier: 'front' | 'back'; rows: SeatRow[] }
export type Zone = { id: string; name: string; categoryKey: string; capacity: number; rect: Rect }

export type VenueLayout =
  | { kind: 'seated'; stage: Rect; sections: SeatSection[]; categories: VenueCategory[] }
  | { kind: 'standing'; stage: Rect; zones: Zone[]; categories: VenueCategory[] }

export type VenueDetail = { venue: Venue; layout: VenueLayout }

/* ----------------------------------------------------------- sample data */

const COLOURS = {
  violet: '#7200f5',
  teal: '#0d9488',
  amber: '#d97706',
  pink: '#db2777',
  blue: '#2563eb',
}

// Stable, ID-shaped strings so the same seat always shows the same ID.
function sampleId(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0')
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(5, 8)}-a${hex.slice(1, 4)}-${hex}${hex.slice(0, 4)}`
}

function rowLabels(count: number, from = 0) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // I and O are skipped to avoid confusion with 1 and 0
  return Array.from({ length: count }, (_, i) => letters[from + i])
}

type SeatedSpec = {
  venueId: string
  orchestra: { rows: number; perRow: number; vipRows: number }
  wings: { rows: number; perRow: number }
  balcony: { rows: number; perRow: number }
}

function seatedLayout(spec: SeatedSpec): VenueLayout {
  const { venueId, orchestra, wings, balcony } = spec
  const section = (
    id: string,
    name: string,
    tier: SeatSection['tier'],
    labels: string[],
    perRow: number,
    categoryFor: (row: string, rowIndex: number, seatIndex: number) => string,
  ): SeatSection => ({
    id: sampleId(`${venueId}:${id}`),
    name,
    tier,
    rows: labels.map((label, r) => ({
      label,
      seats: Array.from({ length: perRow }, (_, s) => ({
        id: sampleId(`${venueId}:${id}:${label}:${s + 1}`),
        number: s + 1,
        categoryKey: categoryFor(label, r, s),
      })),
    })),
  })

  const orchestraRows = rowLabels(orchestra.rows)
  const wingRows = rowLabels(wings.rows)
  const balconyRows = rowLabels(balcony.rows, orchestra.rows)
  const lastWingRow = wingRows[wingRows.length - 1]
  const wing = (side: 'left' | 'right') => (row: string, _r: number, s: number) =>
    row === lastWingRow && (side === 'left' ? s < 2 : s >= wings.perRow - 2) ? 'ACCESSIBLE' : 'STANDARD'

  const sections = [
    section('left', 'Left wing', 'front', wingRows, wings.perRow, wing('left')),
    section('orchestra', 'Orchestra', 'front', orchestraRows, orchestra.perRow, (_row, r) =>
      r < orchestra.vipRows ? 'VIP' : 'PREMIUM',
    ),
    section('right', 'Right wing', 'front', wingRows, wings.perRow, wing('right')),
    section('balcony', 'Balcony', 'back', balconyRows, balcony.perRow, () => 'BALCONY'),
  ]

  const count = (key: string) =>
    sections.reduce((n, sec) => n + sec.rows.reduce((m, row) => m + row.seats.filter((s) => s.categoryKey === key).length, 0), 0)
  const span = (labels: string[]) => `${labels[0]}–${labels[labels.length - 1]}`

  const categories: VenueCategory[] = [
    { key: 'VIP', name: 'VIP', colour: COLOURS.violet, area: `Orchestra · rows ${span(orchestraRows.slice(0, orchestra.vipRows))}` },
    { key: 'PREMIUM', name: 'Premium', colour: COLOURS.teal, area: `Orchestra · rows ${span(orchestraRows.slice(orchestra.vipRows))}` },
    { key: 'STANDARD', name: 'Standard', colour: COLOURS.amber, area: 'Left & right wings' },
    { key: 'ACCESSIBLE', name: 'Accessible', colour: COLOURS.pink, area: `Wings · row ${lastWingRow}, aisle seats` },
    { key: 'BALCONY', name: 'Balcony', colour: COLOURS.blue, area: `Balcony · rows ${span(balconyRows)}` },
  ].map((c) => ({ ...c, places: count(c.key) }))

  return { kind: 'seated', stage: { x: 30, y: 2, w: 40, h: 8 }, sections, categories }
}

type ZoneSpec = { key: string; name: string; colour: string; capacity: number; rect: Rect }

function standingLayout(venueId: string, stage: Rect, specs: ZoneSpec[]): VenueLayout {
  const zones: Zone[] = specs.map((z) => ({
    id: sampleId(`${venueId}:${z.key}`),
    name: z.name,
    categoryKey: z.key,
    capacity: z.capacity,
    rect: z.rect,
  }))
  const categories: VenueCategory[] = specs.map((z) => ({
    key: z.key,
    name: z.name,
    colour: z.colour,
    area: `Zone · x ${z.rect.x}, y ${z.rect.y}, ${z.rect.w} × ${z.rect.h}`,
    places: z.capacity,
  }))
  return { kind: 'standing', stage, zones, categories }
}

const BASE: Omit<Venue, 'totalCapacity'>[] = [
  { id: '7c1e4b2a-91d3-4f0e-a6b5-2d8f3c9e1a07', name: 'Nile Arena', address: '90th Street, New Cairo', city: 'Cairo', country: 'Egypt', kind: 'seated' },
  { id: 'b84f0c6d-3e2a-47b9-8d15-6a0e9f4c2b31', name: 'Riverfront Stage', address: 'Corniche El Nil', city: 'Giza', country: 'Egypt', kind: 'standing' },
  { id: '3a9d7e15-c2f8-4b60-9e4a-81b5d0f6c7e2', name: 'Downtown Hall', address: '26th of July Street', city: 'Cairo', country: 'Egypt', kind: 'seated' },
  { id: 'e2c5a8f1-6b4d-4d7e-b0a3-9f1c8e2d5b46', name: 'Garden Amphitheater', address: 'Central Axis, 6th of October', city: 'Giza', country: 'Egypt', kind: 'standing' },
  { id: '58b1f9d0-a7e3-4c2b-96f8-0d4e7a1c3b95', name: 'Seafront Theatre', address: 'Corniche Road, Stanley', city: 'Alexandria', country: 'Egypt', kind: 'seated' },
  { id: 'c6f3e0b7-2d9a-4e81-a5c4-7b0f2e9d8a13', name: 'Red Sea Open Air', address: 'El Mamsha', city: 'Hurghada', country: 'Egypt', kind: 'standing' },
]

const LAYOUTS: Record<string, VenueLayout> = {
  [BASE[0].id]: seatedLayout({
    venueId: BASE[0].id,
    orchestra: { rows: 8, perRow: 14, vipRows: 3 },
    wings: { rows: 8, perRow: 6 },
    balcony: { rows: 3, perRow: 26 },
  }),
  [BASE[1].id]: standingLayout(BASE[1].id, { x: 30, y: 3, w: 40, h: 11 }, [
    { key: 'FRONT', name: 'Front standing', colour: COLOURS.violet, capacity: 300, rect: { x: 22, y: 19, w: 56, h: 21 } },
    { key: 'GA', name: 'General admission', colour: COLOURS.teal, capacity: 900, rect: { x: 8, y: 45, w: 84, h: 28 } },
    { key: 'GARDEN', name: 'Garden', colour: COLOURS.amber, capacity: 400, rect: { x: 8, y: 78, w: 52, h: 18 } },
    { key: 'LOUNGE', name: 'Side lounge', colour: COLOURS.blue, capacity: 200, rect: { x: 64, y: 78, w: 28, h: 18 } },
  ]),
  [BASE[2].id]: seatedLayout({
    venueId: BASE[2].id,
    orchestra: { rows: 10, perRow: 16, vipRows: 3 },
    wings: { rows: 10, perRow: 6 },
    balcony: { rows: 4, perRow: 20 },
  }),
  [BASE[3].id]: standingLayout(BASE[3].id, { x: 35, y: 4, w: 30, h: 12 }, [
    { key: 'GOLD', name: 'Gold circle', colour: COLOURS.violet, capacity: 200, rect: { x: 30, y: 22, w: 40, h: 18 } },
    { key: 'GENERAL', name: 'General', colour: COLOURS.teal, capacity: 700, rect: { x: 10, y: 46, w: 80, h: 26 } },
    { key: 'LAWN', name: 'Lawn', colour: COLOURS.amber, capacity: 300, rect: { x: 10, y: 78, w: 80, h: 18 } },
  ]),
  [BASE[4].id]: seatedLayout({
    venueId: BASE[4].id,
    orchestra: { rows: 14, perRow: 20, vipRows: 4 },
    wings: { rows: 14, perRow: 8 },
    balcony: { rows: 4, perRow: 34 },
  }),
  [BASE[5].id]: standingLayout(BASE[5].id, { x: 25, y: 3, w: 50, h: 10 }, [
    { key: 'PIT', name: 'Front pit', colour: COLOURS.violet, capacity: 500, rect: { x: 20, y: 17, w: 60, h: 18 } },
    { key: 'GA', name: 'General admission', colour: COLOURS.teal, capacity: 1400, rect: { x: 6, y: 40, w: 88, h: 32 } },
    { key: 'BEACH', name: 'Beach lounge', colour: COLOURS.amber, capacity: 400, rect: { x: 6, y: 77, w: 58, h: 19 } },
    { key: 'TERRACE', name: 'VIP terrace', colour: COLOURS.pink, capacity: 200, rect: { x: 68, y: 77, w: 26, h: 19 } },
  ]),
}

let VENUES: Venue[] = BASE.map((v) => ({
  ...v,
  totalCapacity: LAYOUTS[v.id].categories.reduce((n, c) => n + c.places, 0),
}))

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class VenueNotFoundError extends Error {
  constructor() {
    super('Venue not found')
    this.name = 'VenueNotFoundError'
  }
}

/* ------------------------------------------------------ add, edit, delete */

/**
 * What the add / edit form works with. Row letters run A–Z without I and O.
 * `sourceId` / `sourceKey` point at the section, zone or category the row was loaded from,
 * so saving keeps existing seat IDs, seat categories and zone positions. `rowKey` only keeps
 * the editor's rows stable while editing; saving ignores it.
 */
export type VenueForm = {
  name: string
  address: string
  city: string
  country: string
  kind: VenueKind
  sections: { rowKey?: string; sourceId?: string; name: string; firstRow: string; lastRow: string; seatsPerRow: number; categoryCode: string }[]
  zones: { rowKey?: string; sourceId?: string; name: string; capacity: number; categoryCode: string }[]
  categories: { rowKey?: string; sourceKey?: string; name: string; code: string; colour: string }[]
}

export const CATEGORY_COLOURS = Object.values(COLOURS)
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const MAX_SEATS_PER_ROW = 80

/** Row labels from first to last, or [] when the letters are not a valid range. */
export function rowRange(first: string, last: string) {
  const a = ROW_LETTERS.indexOf(first.toUpperCase())
  const b = ROW_LETTERS.indexOf(last.toUpperCase())
  return a < 0 || b < a ? [] : ROW_LETTERS.slice(a, b + 1).split('')
}

export function formCapacity(form: VenueForm) {
  return form.kind === 'seated'
    ? form.sections.reduce((n, s) => n + rowRange(s.firstRow, s.lastRow).length * s.seatsPerRow, 0)
    : form.zones.reduce((n, z) => n + z.capacity, 0)
}

export type VenueProblem =
  | { field: 'name' | 'address' | 'city' | 'categories' | 'sections' | 'zones' }
  | { field: 'category' | 'section' | 'zone'; index: number }

/** Everything that stops the venue form from saving, in the order the form shows it. */
export function validateVenueForm(form: VenueForm): VenueProblem[] {
  const problems: VenueProblem[] = []
  for (const field of ['name', 'address', 'city'] as const) if (!form[field].trim()) problems.push({ field })
  const codes = form.categories.map((c) => c.code.trim().toUpperCase())
  if (form.kind === 'seated') {
    if (form.sections.length === 0) problems.push({ field: 'sections' })
    form.sections.forEach((s, index) => {
      const bad =
        !s.name.trim() ||
        rowRange(s.firstRow, s.lastRow).length === 0 ||
        s.seatsPerRow < 1 ||
        s.seatsPerRow > MAX_SEATS_PER_ROW ||
        !codes.includes(s.categoryCode)
      if (bad) problems.push({ field: 'section', index })
    })
  } else {
    if (form.zones.length === 0) problems.push({ field: 'zones' })
    form.zones.forEach((z, index) => {
      if (!z.name.trim() || z.capacity < 1 || !codes.includes(z.categoryCode)) problems.push({ field: 'zone', index })
    })
  }
  if (form.categories.length === 0) problems.push({ field: 'categories' })
  form.categories.forEach((c, index) => {
    const code = codes[index]
    if (!c.name.trim() || !code || codes.indexOf(code) !== index) problems.push({ field: 'category', index })
  })
  return problems
}

function mostCommon(keys: string[]) {
  const counts = new Map<string, number>()
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

const sectionKeys = (s: SeatSection) => s.rows.flatMap((r) => r.seats.map((seat) => seat.categoryKey))

/**
 * Build the layout a form describes. When the venue already has a layout, everything the
 * form didn't change is kept: seat IDs, the category of each seat (VIP rows, accessible
 * aisle seats), section tiers, zone positions and the stage.
 */
export function layoutFromForm(id: string, form: VenueForm, previous?: VenueLayout): VenueLayout {
  const cats = form.categories.length ? form.categories : [{ name: 'General', code: 'GENERAL', colour: COLOURS.violet }]
  const codes = cats.map((c) => c.code)
  const renamed = new Map(cats.filter((c) => c.sourceKey).map((c) => [c.sourceKey!, c.code]))
  const carry = (oldKey: string) => {
    const key = renamed.get(oldKey) ?? oldKey
    return codes.includes(key) ? key : null
  }
  const pick = (code: string) => (codes.includes(code) ? code : codes[0])
  const previousArea = (key: string, places: number) => previous?.categories.find((c) => c.key === key && c.places === places)?.area

  if (form.kind === 'seated') {
    const before = previous?.kind === 'seated' ? previous.sections : []
    const sections: SeatSection[] = form.sections.map((s, i) => {
      const prev = before.find((p) => p.id === s.sourceId)
      const sectionId = prev?.id ?? sampleId(`${id}:section:${i}:${s.name}:${Date.now()}`)
      const fallback = pick(s.categoryCode)
      // Choosing another category for the whole section repaints every seat in it.
      const repaint = prev ? carry(mostCommon(sectionKeys(prev))) !== fallback : true
      return {
        id: sectionId,
        name: s.name.trim(),
        tier: prev?.tier ?? (i === form.sections.length - 1 && form.sections.length > 3 ? 'back' : 'front'),
        rows: rowRange(s.firstRow, s.lastRow).map((label) => {
          const prevRow = prev?.rows.find((r) => r.label === label)
          return {
            label,
            seats: Array.from({ length: s.seatsPerRow }, (_, n) => {
              const old = prevRow?.seats.find((seat) => seat.number === n + 1)
              const key = repaint || !old ? fallback : (carry(old.categoryKey) ?? fallback)
              return { id: old?.id ?? sampleId(`${sectionId}:${label}:${n + 1}`), number: n + 1, categoryKey: key }
            }),
          }
        }),
      }
    })
    const categories = cats.map((c) => {
      const places = sections.reduce((n, sec) => n + sec.rows.reduce((m, r) => m + r.seats.filter((st) => st.categoryKey === c.code).length, 0), 0)
      const area = previousArea(c.sourceKey ?? c.code, places) ?? sections.filter((sec) => sectionKeys(sec).includes(c.code)).map((sec) => sec.name).join(', ')
      return { key: c.code, name: c.name.trim(), colour: c.colour, area, places }
    })
    return { kind: 'seated', stage: previous?.stage ?? { x: 30, y: 2, w: 40, h: 8 }, sections, categories }
  }

  const before = previous?.kind === 'standing' ? previous.zones : []
  const kept = form.zones.map((z) => before.find((p) => p.id === z.sourceId))
  const evenHeight = 76 / Math.max(1, form.zones.length)
  let nextY = Math.max(16, ...kept.map((p) => (p ? p.rect.y + p.rect.h + 3 : 0)))
  const zones: Zone[] = form.zones.map((z, i) => {
    const prev = kept[i]
    let rect: Rect
    if (prev) rect = prev.rect
    else if (!kept.some(Boolean)) rect = { x: 8, y: Math.round(18 + i * evenHeight), w: 84, h: Math.max(4, Math.round(evenHeight - 4)) }
    else {
      rect = { x: 8, y: Math.min(nextY, 88), w: 84, h: 8 }
      nextY += 11
    }
    return { id: prev?.id ?? sampleId(`${id}:zone:${i}:${z.name}:${Date.now()}`), name: z.name.trim(), categoryKey: pick(z.categoryCode), capacity: z.capacity, rect }
  })
  const categories = cats.map((c) => {
    const places = zones.filter((z) => z.categoryKey === c.code).reduce((n, z) => n + z.capacity, 0)
    const names = zones.filter((z) => z.categoryKey === c.code).map((z) => z.name)
    return { key: c.code, name: c.name.trim(), colour: c.colour, area: previousArea(c.sourceKey ?? c.code, places) ?? `Zone · ${names.join(', ')}`, places }
  })
  return { kind: 'standing', stage: previous?.stage ?? { x: 30, y: 3, w: 40, h: 10 }, zones, categories }
}

export function formFromLayout(venue: Venue, layout: VenueLayout): VenueForm {
  const base = { name: venue.name, address: venue.address, city: venue.city, country: venue.country, kind: venue.kind }
  const categories = layout.categories.map((c) => ({ rowKey: c.key, sourceKey: c.key, name: c.name, code: c.key, colour: c.colour }))
  if (layout.kind === 'seated') {
    return {
      ...base,
      sections: layout.sections.map((s) => ({
        rowKey: s.id,
        sourceId: s.id,
        name: s.name,
        firstRow: s.rows[0]?.label ?? 'A',
        lastRow: s.rows[s.rows.length - 1]?.label ?? 'A',
        seatsPerRow: Math.max(0, ...s.rows.map((r) => r.seats.length)),
        categoryCode: mostCommon(sectionKeys(s)),
      })),
      zones: [],
      categories,
    }
  }
  return {
    ...base,
    sections: [],
    zones: layout.zones.map((z) => ({ rowKey: z.id, sourceId: z.id, name: z.name, capacity: z.capacity, categoryCode: z.categoryKey })),
    categories,
  }
}

function save(id: string, form: VenueForm): Venue {
  const layout = layoutFromForm(id, form, LAYOUTS[id])
  const venue: Venue = {
    id,
    name: form.name.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
    kind: form.kind,
    totalCapacity: layout.categories.reduce((n, c) => n + c.places, 0),
  }
  LAYOUTS[id] = layout
  const at = VENUES.findIndex((v) => v.id === id)
  VENUES = at < 0 ? [venue, ...VENUES] : VENUES.map((v) => (v.id === id ? venue : v))
  return venue
}

// Deleted venues are kept here so "Undo" can put them back where they were.
const TRASH = new Map<string, { venue: Venue; layout: VenueLayout; index: number }>()

export const venuesApi = {
  async list(): Promise<Venue[]> {
    await delay(350)
    return VENUES
  },
  async getForm(id: string): Promise<VenueForm> {
    await delay(250)
    const venue = VENUES.find((v) => v.id === id)
    if (!venue) throw new VenueNotFoundError()
    return formFromLayout(venue, LAYOUTS[id])
  },
  async create(form: VenueForm): Promise<Venue> {
    await delay(400)
    return save(sampleId(`${form.name}:${Date.now()}`), form)
  },
  async update(id: string, form: VenueForm): Promise<Venue> {
    await delay(400)
    if (!VENUES.some((v) => v.id === id)) throw new VenueNotFoundError()
    return save(id, form)
  },
  /** Venues that events use can't be deleted. */
  async remove(id: string): Promise<Venue> {
    await delay(300)
    const index = VENUES.findIndex((v) => v.id === id)
    if (index < 0) throw new VenueNotFoundError()
    if ((await adminEventsApi.countAtVenue(id)) > 0) throw new AdminApiError('venue-in-use')
    const venue = VENUES[index]
    TRASH.set(id, { venue, layout: LAYOUTS[id], index })
    VENUES = VENUES.filter((v) => v.id !== id)
    return venue
  },
  async restore(id: string): Promise<Venue> {
    await delay(200)
    const item = TRASH.get(id)
    if (!item) throw new VenueNotFoundError()
    TRASH.delete(id)
    LAYOUTS[id] = item.layout
    VENUES = [...VENUES.slice(0, item.index), item.venue, ...VENUES.slice(item.index)]
    return item.venue
  },
  async get(id: string): Promise<VenueDetail> {
    await delay(350)
    const venue = VENUES.find((v) => v.id === id)
    if (!venue) throw new VenueNotFoundError()
    return { venue, layout: LAYOUTS[id] }
  },
}
