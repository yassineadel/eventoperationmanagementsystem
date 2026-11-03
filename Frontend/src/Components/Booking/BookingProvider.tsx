import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BookingContext } from './bookingContext'
import { readBooking, transitionBooking, writeBooking, type BookingAction, type BookingState } from './bookingModel'
import { useApiEvent } from '../../lib/useEventsApi'
import { eventIdPattern } from '../../lib/eventsModel'
import { loadLiveBooking, restoreSelection } from './liveBooking'

export default function BookingProvider({ children, initialState }: { children: ReactNode; initialState?: BookingState }) {
  const [state, setState] = useState(() => initialState ?? readBooking())
  const current = useRef(state)
  const [now, setNow] = useState(Date.now)
  const [names, setNames] = useState<Record<string, string>>({})
  const [storageAvailable, setStorageAvailable] = useState(true)
  // Restore once per app load, including on Home and the seat map. A loaded catalogue
  // does not mean the signed-in user's reserved tickets have been restored.
  const [restoreEventId, setRestoreEventId] = useState(() => !initialState && eventIdPattern.test(state.eventId ?? '') ? state.eventId : null)
  const [restoreFailed, setRestoreFailed] = useState(false)
  const api = useApiEvent(restoreEventId ?? '', Boolean(restoreEventId))
  const data = api.data
  const act = useCallback((action: BookingAction) => {
    const timestamp = Date.now()
    const previous = current.current
    const result = transitionBooking(previous, action, timestamp)
    setNow(timestamp)
    if (result.state !== previous) {
      current.current = result.state
      setState(result.state)
      setStorageAvailable(writeBooking(result.state))
      if (result.state.expired || ['reset', 'release', 'complete'].includes(action.type)) setNames({})
    }
    return result.error
  }, [])
  useEffect(() => {
    if (!restoreEventId || !data) return
    const controller = new AbortController()
    loadLiveBooking(data, controller.signal)
      .then((holds) => {
        if (controller.signal.aborted) return
        if (current.current.eventId === restoreEventId) {
          if (!restoreSelection(act, restoreEventId, holds) && current.current.items.length) act({ type: 'release' })
        }
        setRestoreEventId(null)
      })
      .catch(() => { if (!controller.signal.aborted) setRestoreFailed(true) })
    return () => controller.abort()
  }, [data, restoreEventId, act])
  useEffect(() => {
    if (state.expiresAt === null) return
    const timer = window.setInterval(() => act({ type: 'expire' }), 1000)
    return () => window.clearInterval(timer)
  }, [state.expiresAt, act])
  function setAttendee(key: string, name: string) {
    if (current.current.items.some((item) => item.key === key)) setNames((current) => ({ ...current, [key]: name.slice(0, 100) }))
  }
  const restoration = !restoreEventId || api.status === 'not-found' ? 'ready' : restoreFailed || api.status === 'error' ? 'failed' : 'loading'
  function retryRestore() { setRestoreFailed(false); api.retry() }
  return <BookingContext.Provider value={{ state, now, names, storageAvailable, restoration, retryRestore, act, setAttendee }}>{children}</BookingContext.Provider>
}
