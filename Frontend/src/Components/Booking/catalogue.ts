import { events } from '../Homepage/data/events.ts'
import type { Event, LocalizedText } from '../Homepage/types.ts'
import type { Availability } from '../../lib/bookingApi.ts'

export type TicketCategory = { id: string; name: LocalizedText; description: LocalizedText; price: number; feePercent: number; color: string; capacity: number; remaining: number }
export type Seat = { id: string; section: string; row: string; number: number; categoryId: string; status: 'available' | 'held' | 'sold' }
export type BookingCatalogue = { mode: 'seated' | 'standing'; categories: TicketCategory[]; seats: Seat[] }
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

// The page colours the categories in this order
const tones = ['violet', 'teal', 'amber']

// Turns the backend's availability into the shape the booking pages already use (standing venues)
export function registerLiveCatalogue(event: Event, availability: Availability, feePercents: Record<string, number>) {
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
  catalogues.set(event.id, catalogue)
  return catalogue
}

export function selectionPath(eventId: string) {
  return `/events/${encodeURIComponent(eventId)}/tickets`
}
