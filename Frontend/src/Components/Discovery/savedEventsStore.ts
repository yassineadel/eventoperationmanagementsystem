import { events } from '../Homepage/data/events.ts'

export const savedEventsKey = 'hafletna.saved-events'
const knownIds = new Set(events.map((event) => event.id))
const publicId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validId = (id: unknown): id is string => typeof id === 'string' && (knownIds.has(id) || publicId.test(id))
const canonicalId = (id: string) => publicId.test(id) ? id.toLowerCase() : id
export type SavedEventsStorage = Pick<Storage, 'getItem' | 'setItem'>
type Snapshot = { readonly savedIds: readonly string[]; readonly isPersistent: boolean }

export function parseSavedEventIds(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter(validId).map(canonicalId))].slice(0, 200) : []
  } catch { return [] }
}

export function getBrowserSavedStorage(): SavedEventsStorage | undefined {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined } catch { return undefined }
}

export function createSavedEventsStore(storage?: SavedEventsStorage) {
  function read(): Snapshot {
    try {
      return { savedIds: parseSavedEventIds(storage?.getItem(savedEventsKey) ?? null), isPersistent: Boolean(storage) }
    } catch { return { savedIds: [], isPersistent: false } }
  }
  let snapshot = read()
  const listeners = new Set<() => void>()
  function publish(next: Snapshot) {
    snapshot = next
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    toggle(eventId: string) {
      if (!validId(eventId)) return { saved: false, persisted: snapshot.isPersistent }
      eventId = canonicalId(eventId)
      if (snapshot.savedIds.length >= 200 && !snapshot.savedIds.includes(eventId)) return { saved: false, persisted: snapshot.isPersistent, full: true }
      const saved = !snapshot.savedIds.includes(eventId)
      const savedIds = saved ? [...snapshot.savedIds, eventId] : snapshot.savedIds.filter((id) => id !== eventId)
      let persisted = false
      try { if (storage) { storage.setItem(savedEventsKey, JSON.stringify(savedIds)); persisted = true } } catch { /* Keep the change for this visit. */ }
      publish({ savedIds, isPersistent: persisted })
      return { saved, persisted }
    },
    refresh() {
      if (!storage) return
      const next = read()
      // Preserve this visit's choices if reading storage becomes unavailable.
      publish(next.isPersistent ? next : { ...snapshot, isPersistent: false })
    },
  }
}
export type SavedEventsStore = ReturnType<typeof createSavedEventsStore>
