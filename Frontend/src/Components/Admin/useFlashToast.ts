import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** A toast handed over through navigation state by the page before; shown once, then dropped from history. */
export function useFlashToast<T>() {
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState<T | null>(() => (location.state as { toast?: T } | null)?.toast ?? null)

  useEffect(() => {
    if (location.state) navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])

  return [toast, setToast] as const
}
