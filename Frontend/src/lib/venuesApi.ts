// Venue data for the admin console.
//
// The backend does not expose venue endpoints yet, so this module serves sample data
// shaped like the venue layout described in the assignment: sections, rows and seats
// with IDs for seated venues, zone rectangles on a 0–100 grid for standing venues,
// the stage position and category colours. Adding, editing and deleting change the
// sample data in memory until the page reloads. When the API exists, replace the
// bodies of `venuesApi.*` with calls from './api'.

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

/** What the add / edit form works with. Row letters run A–Z without I and O. */
export type VenueForm = {
  name: string
  address: string
  city: string
  country: string
  kind: VenueKind
  sections: { name: string; firstRow: string; lastRow: string; seatsPerRow: number }[]
  zones: { name: string; capacity: number }[]
  categories: { name: string; code: string; colour: string }[]
}

export const CATEGORY_COLOURS = Object.values(COLOURS)
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

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

function layoutFromForm(id: string, form: VenueForm): VenueLayout {
  const cats = form.categories.length ? form.categories : [{ name: 'General', code: 'GENERAL', colour: COLOURS.violet }]
  const keyOf = (i: number) => cats[i % cats.length].code || `CAT${(i % cats.length) + 1}`
  if (form.kind === 'seated') {
    const sections: SeatSection[] = form.sections.map((s, i) => ({
      id: sampleId(`${id}:section:${i}`),
      name: s.name,
      tier: i === form.sections.length - 1 && form.sections.length > 3 ? 'back' : 'front',
      rows: rowRange(s.firstRow, s.lastRow).map((label) => ({
        label,
        seats: Array.from({ length: s.seatsPerRow }, (_, n) => ({
          id: sampleId(`${id}:${i}:${label}:${n + 1}`),
          number: n + 1,
          categoryKey: keyOf(i),
        })),
      })),
    }))
    const categories = cats.map((c, i) => ({
      key: keyOf(i),
      name: c.name,
      colour: c.colour,
      area: sections.filter((_, j) => keyOf(j) === keyOf(i)).map((sec) => sec.name).join(', '),
      places: sections.reduce(
        (n, sec) => n + sec.rows.reduce((m, r) => m + r.seats.filter((st) => st.categoryKey === keyOf(i)).length, 0),
        0,
      ),
    }))
    return { kind: 'seated', stage: { x: 30, y: 2, w: 40, h: 8 }, sections, categories }
  }
  const height = 76 / Math.max(1, form.zones.length)
  return standingLayout(
    id,
    { x: 30, y: 3, w: 40, h: 10 },
    form.zones.map((z, i) => ({
      key: keyOf(i),
      name: z.name,
      colour: cats[i % cats.length].colour,
      capacity: z.capacity,
      rect: { x: 8, y: Math.round(18 + i * height), w: 84, h: Math.max(4, Math.round(height - 4)) },
    })),
  )
}

function formFromLayout(venue: Venue, layout: VenueLayout): VenueForm {
  const base = { name: venue.name, address: venue.address, city: venue.city, country: venue.country, kind: venue.kind }
  const categories = layout.categories.map((c) => ({ name: c.name, code: c.key, colour: c.colour }))
  if (layout.kind === 'seated') {
    return {
      ...base,
      sections: layout.sections.map((s) => ({
        name: s.name,
        firstRow: s.rows[0]?.label ?? 'A',
        lastRow: s.rows[s.rows.length - 1]?.label ?? 'A',
        seatsPerRow: s.rows[0]?.seats.length ?? 0,
      })),
      zones: [],
      categories,
    }
  }
  return { ...base, sections: [], zones: layout.zones.map((z) => ({ name: z.name, capacity: z.capacity })), categories }
}

function save(id: string, form: VenueForm): Venue {
  const layout = layoutFromForm(id, form)
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
  async remove(id: string): Promise<Venue> {
    await delay(300)
    const index = VENUES.findIndex((v) => v.id === id)
    if (index < 0) throw new VenueNotFoundError()
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
