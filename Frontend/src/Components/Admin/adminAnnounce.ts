import { createContext, useContext } from 'react'

export type Announce = (text: string, urgency?: 'polite' | 'assertive') => void

/** Speaks a message through the console's always-present live regions (see AdminLayout). */
export const AnnounceContext = createContext<Announce>(() => {})

export function useAnnounce() {
  return useContext(AnnounceContext)
}
