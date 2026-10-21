export type Language = 'en' | 'ar'
export type LocalizedText = Record<Language, string>
export type Category = 'concerts' | 'festivals' | 'arts' | 'sports' | 'workshops' | 'conferences'
export type City = 'cairo' | 'alexandria' | 'giza'
export type EventView = 'upcoming' | 'trending' | 'for-you'
export type EventStatus = 'available' | 'sold-out' | 'cancelled'
export type Event = {
  id: string
  title: LocalizedText
  description: LocalizedText
  venue: LocalizedText
  category: Category
  city: City
  date: string
  price: number | null
  source?: 'api'
  performer?: LocalizedText
  status: EventStatus
  image: string
  featured?: boolean
  activity: { views: number; registrations: number }
}
export type Venue = { id: string; name: LocalizedText; city: City; description: LocalizedText; image: string }
export type RecommendationPreferences = { interests: Category[]; city: City | '' }
export type Filters = { query: string; city: City | ''; category: Category | ''; date: string }
export const emptyFilters: Filters = { query: '', city: '', category: '', date: '' }
