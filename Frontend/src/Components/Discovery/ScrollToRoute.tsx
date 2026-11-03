import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToRoute() {
  const { pathname, hash, key } = useLocation()
  const previousPath = useRef<string | null>(null)
  useEffect(() => {
    const pathChanged = previousPath.current !== pathname
    previousPath.current = pathname
    let targetId = ''
    try { targetId = decodeURIComponent(hash.slice(1)) } catch { /* Ignore malformed fragment links. */ }
    if (!targetId) {
      const frame = requestAnimationFrame(() => {
        if (pathChanged || pathname === '/') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      })
      return () => cancelAnimationFrame(frame)
    }

    // Catalogue results, photos and lazy routes can move an anchor after navigation.
    // Follow those layout changes until the visitor starts interacting with the page.
    let frame = 0
    let stopped = false
    const align = () => {
      if (stopped || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'instant', block: 'start' })
      })
    }
    const resize = new ResizeObserver(align)
    const mutations = new MutationObserver(align)
    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
      window.clearTimeout(timeout)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('pointerdown', stop)
      window.removeEventListener('keydown', stop)
    }
    const timeout = window.setTimeout(stop, 15000)
    resize.observe(document.body)
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('pointerdown', stop, { passive: true })
    window.addEventListener('keydown', stop)
    align()
    return stop
  }, [pathname, hash, key])
  return null
}
