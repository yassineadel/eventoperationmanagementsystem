import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Warns before leaving a form with unsaved changes. Clicks on links inside the app (the
 * sidebar, breadcrumbs, Back and Cancel) are held until the admin confirms; closing or
 * reloading the tab gets the browser's own warning. The browser Back button isn't covered:
 * the app uses <BrowserRouter>, which can't block history navigation.
 */
export function useUnsavedChanges(dirty: boolean) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Links within the same page, such as "Skip to content", don't leave the form.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      const to = `${url.pathname}${url.search}${url.hash}`
      e.preventDefault()
      e.stopPropagation()
      setPending(to)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  return {
    pending,
    stay: () => setPending(null),
    leave: () => {
      const to = pending
      setPending(null)
      if (to) navigate(to)
    },
  }
}
