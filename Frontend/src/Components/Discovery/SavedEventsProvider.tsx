import { useEffect, useState, type ReactNode } from 'react'
import { SavedEventsContext } from './savedEventsContext'
import { createSavedEventsStore, getBrowserSavedStorage, savedEventsKey, type SavedEventsStorage } from './savedEventsStore'

export default function SavedEventsProvider({ children, storage }: { children: ReactNode; storage?: SavedEventsStorage }) {
  const [store] = useState(() => createSavedEventsStore(storage ?? getBrowserSavedStorage()))
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === savedEventsKey || event.key === null) store.refresh()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [store])
  return <SavedEventsContext.Provider value={store}>{children}</SavedEventsContext.Provider>
}
