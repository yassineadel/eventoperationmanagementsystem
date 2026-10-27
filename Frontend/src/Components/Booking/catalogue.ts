import { events } from '../Homepage/data/events.ts'
import type { Event, LocalizedText } from '../Homepage/types.ts'
import type { Availability, SeatedLayout } from '../../lib/bookingApi.ts'

export type TicketCategory = { id: string; name: LocalizedText; description: LocalizedText; price: number; feePercent: number; color: string; capacity: number; remaining: number }
// categoryId is '' for a real seat whose category is not on sale for this event (it is shown as unavailable)
export type Seat = { id: string; section: string; row: string; number: number; categoryId: string; status: 'available' | 'held' | 'sold' }
// How the seat map is drawn: sections, each with rows of seats, in venue order
export type SeatSection = { key: string; label: LocalizedText; color: string; price?: number; rows: { label: string; seats: Seat[] }[] }
export type BookingCatalogue = { mode: 'seated' | 'standing'; categories: TicketCategory[]; seats: Seat[]; sections?: SeatSection[] }
const catalogues = new Map<string, BookingCatalogue>()

// Sample identifiers are deliberately separate from any real venue or inventory IDs.
export function getBookingCatalogue(eventId: string): BookingCatalogue | null {
  const cached = catalogues.get(eventId)
  if (cached) return cached
  const event = events.find((item) => item.id === eventId)
  if (!event || event.price === null) return null
  const basePrice = event.price
  const seated = ['next-perspectives', 'design-together', 'creative-canvas'].includes(eventId)
  const definitions = seated ? [
    { id: 'front', name: { en: 'Front circle', ar: 'المقاعد الأمامية' }, description: { en: 'Close to the stage. At the heart of it all.', ar: 'بالقرب من المسرح، في قلب التجربة.' }, multiplier: 1.6, color: 'violet', remaining: 64 },
    { id: 'middle', name: { en: 'Grand circle', ar: 'المقاعد الوسطى' }, description: { en: 'A balanced view and a little perspective.', ar: 'رؤية متوازنة ومساحة للاستمتاع بالتفاصيل.' }, multiplier: 1.25, color: 'teal', remaining: 64 },
    { id: 'rear', name: { en: 'Upper circle', ar: 'المقاعد الخلفية' }, description: { en: 'Take in the whole room.', ar: 'استمتع بإطلالة على القاعة بأكملها.' }, multiplier: 1, color: 'amber', remaining: 64 },
  ] : [
    { id: 'front', name: { en: 'Front of stage', ar: 'أمام المسرح' }, description: { en: 'Up close, with the energy of the front row.', ar: 'اقترب من المسرح واستمتع بحماس الصفوف الأولى.' }, multiplier: 1.6, color: 'violet', remaining: 18 },
    { id: 'middle', name: { en: 'The main floor', ar: 'الساحة الرئيسية' }, description: { en: 'Room to move. A great view. Your kind of night.', ar: 'مساحة للحركة ورؤية مميزة وأجواء تناسبك.' }, multiplier: 1, color: 'teal', remaining: 54 },
    { id: 'rear', name: { en: 'Garden terrace', ar: 'تراس الحديقة' }, description: { en: 'A relaxed space to enjoy the atmosphere.', ar: 'مساحة هادئة للاستمتاع بالأجواء.' }, multiplier: 1.25, color: 'amber', remaining: 0 },
  ]
  const categories: TicketCategory[] = definitions.map((item, index) => ({
    id: item.id, name: item.name, description: item.description, color: item.color,
    price: Math.round(basePrice * item.multiplier), feePercent: [10, 8, 12][index], capacity: seated ? 80 : [60, 120, 40][index],
    remaining: event.status === 'available' ? item.remaining : 0,
  }))
  const seats: Seat[] = seated ? Array.from({ length: 240 }, (_, index) => {
    const section = Math.floor(index / 80)
    return { id: `sample-${eventId}-${index + 1}`, section: categories[section].id, row: String.fromCharCode(65 + Math.floor(index / 20)), number: index % 20 + 1, categoryId: categories[section].id,
      status: event.status !== 'available' || index % 11 === 0 ? 'sold' : index % 17 === 0 ? 'held' : 'available' }
  }) : []
  if (seated) for (const category of categories) category.remaining = seats.filter((seat) => seat.categoryId === category.id && seat.status === 'available').length
  const catalogue: BookingCatalogue = { mode: seated ? 'seated' : 'standing', categories, seats }
  catalogues.set(eventId, catalogue)
  return catalogue
}

// ---------- Real events from the backend ----------

// Real events the user opened, so the rest of the booking code can find them by id
const liveEvents = new Map<string, Event>()

// Finds an event by id: a real one from the backend first, otherwise a sample one
export function getBookingEvent(eventId: string): Event | undefined {
  return liveEvents.get(eventId) ?? events.find((event) => event.id === eventId)
}

// The real event's policies, for the policy window at checkout
type Policy = { title: LocalizedText; body: LocalizedText }
const livePolicies = new Map<string, Policy[]>()
export function getLivePolicies(eventId: string): Policy[] {
  return livePolicies.get(eventId) ?? []
}

// True for a real event from the backend (not a sample one)
export function isLiveEvent(eventId: string) {
  return liveEvents.has(eventId)
}

// The page colours the categories in this order
const tones = ['violet', 'teal', 'amber']

// Turns the backend's availability into the shape the booking pages already use (standing venues)
export function registerLiveCatalogue(event: Event, availability: Availability, feePercents: Record<string, number>, policies: Policy[]) {
  const categories: TicketCategory[] = availability.categories.map((category, index) => ({
    id: category.id,
    name: { en: category.name, ar: category.name },
    description: { en: '', ar: '' },
    price: Number(category.price),
    feePercent: feePercents[category.id] ?? 0,
    color: tones[index % tones.length],
    capacity: category.capacity,
    remaining: category.available,
  }))
  const catalogue: BookingCatalogue = { mode: 'standing', categories, seats: [] }
  liveEvents.set(event.id, event)
  livePolicies.set(event.id, policies)
  catalogues.set(event.id, catalogue)
  return catalogue
}

/**
 * A seat's label as the server writes it in the cart: section-row-number, e.g. "ORC-A-5".
 * Used to match the server's holds to the seats the user chose.
 */
export function seatLabel(seat: Pick<Seat, 'section' | 'row' | 'number'>) {
  return `${seat.section}-${seat.row}-${seat.number}`
}

/**
 * The sections of the seat map. Real events bring their own (from the venue layout).
 * Sample events have one section per category, made of their rows, so they look exactly as before.
 */
export function seatSections(catalogue: BookingCatalogue): SeatSection[] {
  if (catalogue.sections) return catalogue.sections
  return catalogue.categories.map((category) => {
    const rows: SeatSection['rows'] = []
    for (const seat of catalogue.seats.filter((seat) => seat.section === category.id)) {
      const row = rows.find((row) => row.label === seat.row)
      if (row) row.seats.push(seat)
      else rows.push({ label: seat.row, seats: [seat] })
    }
    return { key: category.id, label: category.name, color: category.color, price: category.price, rows }
  })
}

// The section a seat is in (for the seat details and ticket descriptions)
export function seatSectionOf(catalogue: BookingCatalogue, seat: Seat) {
  return seatSections(catalogue).find((section) => section.key === seat.section)
}

/**
 * Seated venues: turns the venue layout and the backend's availability into the shape the booking pages use.
 * - Each seat gets the event's ticket category with the same categoryKey.
 * - Sold seats are 'sold'; seats held by someone else are 'held'.
 * - ownSeatLabels: seats the user already holds (from their cart). They count as available for this user,
 *   so going back from the cart to the map keeps them selectable.
 */
export function registerLiveSeatedCatalogue(event: Event, availability: Availability, layout: SeatedLayout, feePercents: Record<string, number>, policies: Policy[], ownSeatLabels: string[]) {
  const categories: TicketCategory[] = availability.categories.map((category, index) => ({
    id: category.id,
    name: { en: category.name, ar: category.name },
    description: { en: '', ar: '' },
    price: Number(category.price),
    feePercent: feePercents[category.id] ?? 0,
    color: tones[index % tones.length],
    capacity: category.capacity,
    remaining: category.available,
  }))
  const categoryByKey = new Map(availability.categories.map((category) => [category.categoryKey, category.id]))
  const held = new Set(availability.heldSeatIds)
  const sold = new Set(availability.soldSeatIds)
  const own = new Set(ownSeatLabels)

  const seats: Seat[] = []
  // Rows without seats (and sections without rows) are left out, so every drawn row has at least one seat
  const sections: SeatSection[] = layout.sections.filter((section) => section.rows.some((row) => row.seats.length)).map((section) => ({
    key: section.key,
    label: { en: section.label, ar: section.label },
    // Real sections mix categories, so each seat has its own colour; the section frame uses the brand colour
    color: 'violet',
    rows: section.rows.filter((row) => row.seats.length).map((row) => ({
      label: row.label,
      seats: row.seats.map((layoutSeat) => {
        const base = { id: layoutSeat.id, section: section.key, row: row.label, number: layoutSeat.number }
        const categoryId = categoryByKey.get(layoutSeat.categoryKey) ?? ''
        const status: Seat['status'] = !categoryId || sold.has(layoutSeat.id) ? 'sold'
          : held.has(layoutSeat.id) && !own.has(seatLabel(base)) ? 'held'
          : 'available'
        const seat: Seat = { ...base, categoryId, status }
        seats.push(seat)
        return seat
      }),
    })),
  }))

  const catalogue: BookingCatalogue = { mode: 'seated', categories, seats, sections }
  liveEvents.set(event.id, event)
  livePolicies.set(event.id, policies)
  catalogues.set(event.id, catalogue)
  return catalogue
}

export function selectionPath(eventId: string) {
  return `/events/${encodeURIComponent(eventId)}/tickets`
}
