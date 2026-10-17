import { useState } from 'react'
import { categoryNames, cityNames } from './strings'
import { defaultRecommendations } from './recommendations'
import type { RecommendationPreferences } from './types'

const storageKey = 'hafletna.recommendations'

function readPreferences(): RecommendationPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!stored || typeof stored !== 'object') return defaultRecommendations
    return {
      interests: Array.isArray(stored.interests)
        ? [...new Set(stored.interests.filter((value: unknown) => typeof value === 'string' && Object.hasOwn(categoryNames, value)))] as RecommendationPreferences['interests']
        : [],
      city: typeof stored.city === 'string' && Object.hasOwn(cityNames, stored.city) ? stored.city : '',
    }
  } catch {
    return defaultRecommendations
  }
}

export function useRecommendations() {
  const [preferences, setPreferences] = useState<RecommendationPreferences>(readPreferences)

  function updatePreferences(next: RecommendationPreferences) {
    setPreferences(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Recommendations still work for this visit when browser storage is blocked.
    }
  }

  return { preferences, updatePreferences }
}
