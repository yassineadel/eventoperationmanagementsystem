import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BookingContext } from './bookingContext'
import { readBooking, transitionBooking, writeBooking, type BookingAction, type BookingState } from './bookingModel'

export default function BookingProvider({ children, initialState }: { children: ReactNode; initialState?: BookingState }) {
  const [state, setState] = useState(() => initialState ?? readBooking())
  const current = useRef(state)
  const [now, setNow] = useState(Date.now)
  const [names, setNames] = useState<Record<string, string>>({})
  const [storageAvailable, setStorageAvailable] = useState(true)
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
    if (state.expiresAt === null) return
    const timer = window.setInterval(() => act({ type: 'expire' }), 1000)
    return () => window.clearInterval(timer)
  }, [state.expiresAt, act])
  function setAttendee(key: string, name: string) {
    if (current.current.items.some((item) => item.key === key)) setNames((current) => ({ ...current, [key]: name.slice(0, 100) }))
  }
  return <BookingContext.Provider value={{ state, now, names, storageAvailable, act, setAttendee }}>{children}</BookingContext.Provider>
}
