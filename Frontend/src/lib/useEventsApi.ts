import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError, API_URL, getJson } from './api'
import { createEventsClient, loadSavedEvents, type EventsClient } from './eventsApi'
import { eventRequest } from './eventRequests'
import { eventIdPattern, listingApiQuery } from './eventsModel'
import { parseListingFilters, type ListingFilters } from '../Components/Discovery/listing'

// null explicitly selects the local preview catalogue (also used by offline render tests).
export const EventsClientContext = createContext<EventsClient | null>(createEventsClient(getJson, API_URL))
export type Resource<T> = { status: 'idle' | 'loading' | 'success' | 'error' | 'not-found'; data: T | null; retry: () => void }
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled: boolean): Resource<T> {
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${key}|${attempt}`
  const [state, setState] = useState<{ key: string; status: 'success' | 'error' | 'not-found'; data: T | null } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    eventRequest(load, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key: requestKey, status: 'success', data })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ key: requestKey, status: error instanceof ApiError && error.status === 404 ? 'not-found' : 'error', data: null })
    })
    return () => controller.abort()
  }, [requestKey, load, enabled])
  return { ...(enabled ? state?.key === requestKey ? state : { status: 'loading' as const, data: null } : { status: 'idle' as const, data: null }), retry: () => setAttempt((value) => value + 1) }
}
export function useApiListing(filters: ListingFilters, enabled: boolean) {
  const client = useContext(EventsClientContext)
  const query = listingApiQuery(filters)
  const load = useCallback((signal: AbortSignal) => client!.listing(parseListingFilters(new URLSearchParams(query)), signal), [client, query])
  return useResource(query, load, enabled && Boolean(client))
}
export function useApiCounts(filters: ListingFilters, enabled: boolean) {
  const client = useContext(EventsClientContext)
  const query = listingApiQuery(filters, true)
  const load = useCallback((signal: AbortSignal) => client!.counts(parseListingFilters(new URLSearchParams(query)), signal), [client, query])
  return useResource(query, load, enabled && Boolean(client))
}
export function useApiEvent(id: string, enabled = true) {
  const client = useContext(EventsClientContext)
  const load = useCallback((signal: AbortSignal) => client!.detail(id, signal), [client, id])
  return useResource(id, load, enabled && eventIdPattern.test(id) && Boolean(client))
}
export function useApiSavedEvents(ids: readonly string[], enabled: boolean) {
  const client = useContext(EventsClientContext)
  const key = ids.filter((id) => eventIdPattern.test(id)).sort().join(',')
  const load = useCallback((signal: AbortSignal) => loadSavedEvents(client!, key.split(',').filter(Boolean), signal), [client, key])
  return useResource(key, load, enabled && Boolean(key) && Boolean(client))
}
