import type { Event, RecommendationPreferences } from './types'

export const defaultRecommendations: RecommendationPreferences = { interests: [], city: '' }

function popularity(event: Event): number {
  return event.activity.views + event.activity.registrations * 10
}

export function trendingEvents(events: Event[], limit = 3): Event[] {
  return [...events].sort((a, b) => popularity(b) - popularity(a) || a.id.localeCompare(b.id)).slice(0, limit)
}

export function recommendedEvents(events: Event[], preferences: RecommendationPreferences): Event[] {
  const matches = events.filter((event) =>
    (!preferences.city || event.city === preferences.city)
    && (!preferences.interests.length || preferences.interests.includes(event.category)),
  )
  return trendingEvents(matches)
}
