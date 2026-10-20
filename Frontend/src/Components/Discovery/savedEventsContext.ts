import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SavedEventsStore } from './savedEventsStore'

export const SavedEventsContext = createContext<SavedEventsStore | null>(null)

export function useSavedEvents() {
  const store = useContext(SavedEventsContext)
  if (!store) throw new Error('Saved events require SavedEventsProvider')
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return { ...state, toggleSaved: store.toggle }
}
