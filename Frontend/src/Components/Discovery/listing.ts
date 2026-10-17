import { categoryNames, cityNames } from '../Homepage/strings.ts'
import { filterEvents } from '../Homepage/discovery.ts'
import { emptyFilters, type Category, type City, type Event, type Language } from '../Homepage/types.ts'

export const sortOrders = ['soonest', 'popular', 'price-low', 'price-high', 'name'] as const
export type SortOrder = typeof sortOrders[number]
export type ListingFilters = {
  query: string; categories: Category[]; city: City | ''; from: string; to: string;
  price: 'all' | 'free' | 'paid'; sort: SortOrder; page: number; savedOnly: boolean;
}
export const pageSize = 6

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}

export function parseListingFilters(params: URLSearchParams): ListingFilters {
  const categoryValues = params.getAll('category').filter((value): value is Category => Object.hasOwn(categoryNames, value))
  const city = params.get('city') ?? ''
  const sort = params.get('sort') ?? ''
  const price = params.get('price')
  const page = Number(params.get('page'))
  const date = validDate(params.get('date'))
  return {
    query: (params.get('q') ?? '').trim(), categories: [...new Set(categoryValues)],
    city: Object.hasOwn(cityNames, city) ? city as City : '',
    from: validDate(params.get('from')) || date, to: validDate(params.get('to')) || date,
    price: price === 'free' || price === 'paid' ? price : 'all',
    sort: sortOrders.includes(sort as SortOrder) ? sort as SortOrder : 'soonest',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    savedOnly: params.get('saved') === '1',
  }
}

export function listingSearchParams(filters: ListingFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.query.trim()) params.set('q', filters.query.trim())
  filters.categories.forEach((category) => params.append('category', category))
  if (filters.city) params.set('city', filters.city)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.price !== 'all') params.set('price', filters.price)
  if (filters.sort !== 'soonest') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.savedOnly) params.set('saved', '1')
  return params
}

export function getListingResults(events: Event[], filters: ListingFilters, lang: Language, savedIds: readonly string[] = []) {
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to)
  const saved = new Set(savedIds)
  const filtered = invalidDates ? [] : filterEvents(events, { ...emptyFilters, query: filters.query, city: filters.city }).filter((event) => {
    const day = event.date.slice(0, 10)
    return (!filters.categories.length || filters.categories.includes(event.category))
      && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && (filters.price === 'all' || (filters.price === 'free' ? event.price === 0 : event.price > 0))
      && (!filters.savedOnly || saved.has(event.id))
  })
  const popularity = (event: Event) => event.activity.views + event.activity.registrations * 10
  const sorted = [...filtered].sort((a, b) => {
    const fallback = a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    switch (filters.sort) {
      case 'popular': return popularity(b) - popularity(a) || fallback
      case 'price-low': return a.price - b.price || fallback
      case 'price-high': return b.price - a.price || fallback
      case 'name': return a.title[lang].localeCompare(b.title[lang], lang) || fallback
      default: return fallback
    }
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = Math.min(filters.page, pageCount)
  const start = sorted.length ? (page - 1) * pageSize + 1 : 0
  return { events: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page, pageCount, start, end: Math.min(page * pageSize, sorted.length), invalidDates }
}
