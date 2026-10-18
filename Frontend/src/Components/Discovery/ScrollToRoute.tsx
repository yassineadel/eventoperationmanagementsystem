import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToRoute() {
  const { pathname, hash } = useLocation()
  const previousPath = useRef<string | null>(null)
  useEffect(() => {
    const pathChanged = previousPath.current !== pathname
    previousPath.current = pathname
    const frame = requestAnimationFrame(() => {
      let target: HTMLElement | null = null
      try { target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null } catch { /* Ignore malformed fragment links. */ }
      if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' })
      else if (pathChanged || pathname === '/') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return null
}
