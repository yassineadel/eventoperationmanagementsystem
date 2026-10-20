import type { Event, Filters, Language } from './types'
import { cityNames, categoryNames } from './strings.ts'

export function filterEvents(events: Event[], filters: Filters): Event[] {
  const query = filters.query.trim().toLocaleLowerCase()
  return events.filter((event) => {
    const searchable = [...Object.values(event.title), ...Object.values(event.venue), ...Object.values(cityNames[event.city]), ...Object.values(categoryNames[event.category])].join(' ').toLocaleLowerCase()
    return (!query || searchable.includes(query)) && (!filters.city || event.city === filters.city)
      && (!filters.category || event.category === filters.category) && (!filters.date || event.date.slice(0, 10) === filters.date)
  }).sort((a, b) => a.date.localeCompare(b.date))
}
export function formatDate(date: string, lang: Language, includeTime = false) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } as const : {}),
  }).format(new Date(date))
}
export function formatPrice(price: number, lang: Language) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(price)
}
