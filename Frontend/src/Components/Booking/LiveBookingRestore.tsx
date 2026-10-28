import { useEffect, useState, type ReactNode } from 'react'
import { useApiEvent } from '../../lib/useEventsApi'
import { eventIdPattern } from '../../lib/eventsModel'
import { useBooking } from './bookingContext'
import { isLiveEvent } from './catalogue'
import { loadLiveBooking, restoreSelection } from './liveBooking'
import { useBookingStrings } from './liveStrings'

/**
 * Wraps the cart and checkout pages. After a page refresh the saved booking only says WHICH real event it was
 * (see readBooking): this loads that event, its catalogue and the user's holds from the backend again,
 * and rebuilds the selection from the server's holds before showing the page.
 * Sample events, and real events already loaded in this visit, are shown straight away.
 */
export default function LiveBookingRestore({ children }: { children: ReactNode }) {
  const { state, act } = useBooking()
  const t = useBookingStrings()
  const eventId = state.eventId ?? ''
  // Needed only when the saved event is a real one whose catalogue isn't loaded yet
  const needed = eventIdPattern.test(eventId) && !isLiveEvent(eventId)
  const api = useApiEvent(eventId, needed)
  const [status, setStatus] = useState<'loading' | 'done' | 'failed'>('loading')
  const data = needed ? api.data : undefined

  useEffect(() => {
    if (!data) return
    const controller = new AbortController()
    loadLiveBooking(data, controller.signal)
      .then((holds) => {
        restoreSelection(act, data.event.id, holds)
        setStatus('done')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('failed') })
    return () => controller.abort()
  }, [data, act])

  // Nothing to restore, finished, or the event no longer exists (the page then shows its empty state)
  if (!needed || status === 'done' || api.status === 'not-found') return children
  if (api.status === 'error' || status === 'failed') return <section className="home-container discovery-not-found" role="alert"><h1 className="discovery-title">{t.loadError}</h1><button type="button" className="home-button" onClick={() => window.location.reload()}>{t.retry}</button></section>
  return <section className="home-container" role="status"><p>{t.restoring}</p></section>
}
