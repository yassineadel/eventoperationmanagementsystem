// Hooks shared by the console pages: loading data from the API, and running changes with a toast.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ToastKind = 'ok' | 'error'
export const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {})
export const useToast = () => useContext(ToastContext)

/**
 * Loads data and reloads it whenever `deps` change or `reload()` is called.
 * `loading` is derived from which request the current data belongs to, so the effect only ever sets
 * state once the request finishes.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [tick, setTick] = useState(0)
  const what = JSON.stringify(deps)
  const key = JSON.stringify([what, tick])
  const [state, setState] = useState<{ key: string; what: string; data: T | null; error: string }>({ key: '', what: '', data: null, error: '' })
  useEffect(() => {
    let alive = true
    load()
      .then((data) => { if (alive) setState({ key, what, data, error: '' }) })
      .catch((e) => { if (alive) setState((s) => ({ key, what, data: s.what === what ? s.data : null, error: e instanceof Error ? e.message : 'Could not load' })) })
    return () => { alive = false }
    // `key` captures every dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), [])
  // Data for other filters is never shown: after a filter change the page shows "loading" until the new
  // results arrive. A plain reload (same filters) keeps the current data on screen meanwhile.
  return { data: state.what === what ? state.data : null, error: state.error, loading: state.key !== key, reload: useCallback(() => setTick((t) => t + 1), []), setData }
}

/** Runs a change, shows a toast, then calls `after` (usually a reload). Resolves to false on failure. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true)
    try {
      await fn()
      toast(success)
      after?.()
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }, [toast])
  return { run, busy }
}

/** The time when the page opened; pages use it instead of calling Date.now() while rendering */
export const useNow = () => useState(() => Date.now())[0]
