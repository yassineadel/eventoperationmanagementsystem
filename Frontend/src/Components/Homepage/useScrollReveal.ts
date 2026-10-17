import { useLayoutEffect, useRef } from 'react'

// Content starts visible; motion is an enhancement, never a condition for access.
export function useScrollReveal<T extends HTMLElement>(itemCount: number) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-reveal]'))
      .filter((item) => item.dataset.scrollReveal !== 'visible')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const showAll = () => items.forEach((item) => { item.dataset.scrollReveal = 'visible' })
    if (reducedMotion.matches || typeof IntersectionObserver === 'undefined') {
      showAll()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const item = entry.target as HTMLElement
        item.dataset.scrollReveal = 'visible'
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' })

    items.forEach((item, index) => {
      item.style.setProperty('--reveal-delay', `${(index % 3) * 55}ms`)
      item.dataset.scrollReveal = 'pending'
      observer.observe(item)
    })

    function revealFocusedItem(event: FocusEvent) {
      const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-scroll-reveal]') : null
      if (!item || !root?.contains(item)) return
      item.style.setProperty('--reveal-delay', '0ms')
      item.dataset.scrollReveal = 'visible'
      observer.unobserve(item)
    }
    function handleMotionChange() {
      if (!reducedMotion.matches) return
      showAll()
      observer.disconnect()
    }

    root.addEventListener('focusin', revealFocusedItem)
    reducedMotion.addEventListener('change', handleMotionChange)
    return () => {
      observer.disconnect()
      root.removeEventListener('focusin', revealFocusedItem)
      reducedMotion.removeEventListener('change', handleMotionChange)
    }
  }, [itemCount])

  return ref
}
