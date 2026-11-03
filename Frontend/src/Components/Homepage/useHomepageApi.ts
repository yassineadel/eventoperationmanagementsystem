import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { API_URL, getJson } from '../../lib/api'
import { EventsClientContext, useResource } from '../../lib/useEventsApi'
import { eventRequest } from '../../lib/eventRequests'
import { listingApiQuery, type EventsPage } from '../../lib/eventsModel'
import { parseListingFilters, type ListingFilters } from '../Discovery/listing'
import { parsePublicVenues } from '../../lib/homepageApi'

export function useHomepageVenues() {
  const load = useCallback(async (signal: AbortSignal) => parsePublicVenues(await getJson<unknown>('/api/venues', { signal }), API_URL), [])
  return useResource('homepage-venues', load, true)
}

type PageState = { key: string; data: EventsPage | null; failed: boolean; loadingMore: boolean; moreFailed: boolean }

export function useHomepageEvents(filters: ListingFilters, conflict: boolean) {
  const client = useContext(EventsClientContext)
  const query = listingApiQuery(filters)
  const [attempt, setAttempt] = useState(0)
  const key = `${query}|${attempt}`
  const [state, setState] = useState<PageState | null>(null)
  const pending = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    if (conflict || !client) return
    const request = new AbortController()
    controller.current = request; pending.current = true
    eventRequest((signal) => client.listing(parseListingFilters(new URLSearchParams(query)), signal), request.signal)
      .then((data) => { if (!request.signal.aborted) setState({ key, data, failed: false, loadingMore: false, moreFailed: false }) })
      .catch(() => { if (!request.signal.aborted) setState({ key, data: null, failed: true, loadingMore: false, moreFailed: false }) })
      .finally(() => { if (controller.current === request) pending.current = false })
    return () => request.abort()
  }, [query, key, client, conflict])
  const current = state?.key === key ? state : null
  const data = current?.data ?? null
  async function loadMore() {
    const request = controller.current
    if (!client || !request || request.signal.aborted || pending.current || !data || data.page >= data.pageCount) return
    pending.current = true
    setState((previous) => previous?.key === key ? { ...previous, loadingMore: true, moreFailed: false } : previous)
    try {
      const next = await eventRequest((signal) => client.listing({ ...parseListingFilters(new URLSearchParams(query)), page: data.page + 1 }, signal), request.signal)
      if (!request.signal.aborted) setState((previous) => previous?.key === key && previous.data ? {
        ...previous, loadingMore: false, data: { ...next, events: [...new Map([...previous.data.events, ...next.events].map((event) => [event.id, event])).values()] },
      } : previous)
    } catch {
      if (!request.signal.aborted) setState((previous) => previous?.key === key ? { ...previous, loadingMore: false, moreFailed: true } : previous)
    } finally { if (controller.current === request) pending.current = false }
  }
  return {
    key,
    events: conflict ? [] : data?.events ?? [], total: conflict ? 0 : data?.total ?? 0,
    loading: !conflict && Boolean(client) && !current,
    failed: !conflict && (!client || Boolean(current?.failed)),
    hasMore: !conflict && Boolean(data && data.page < data.pageCount),
    loadingMore: Boolean(current?.loadingMore), moreFailed: Boolean(current?.moreFailed),
    loadMore, retry: () => setAttempt((value) => value + 1),
  }
}
