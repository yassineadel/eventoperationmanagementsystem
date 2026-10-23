import { useCallback, useEffect, useRef, useState } from 'react'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'not-found' }
  | { status: 'ready'; data: T }

/**
 * Loads data for an admin page. `key` identifies what is loaded (an ID, or the page name):
 * when it changes, or after `retry()`, the state goes back to loading and `load` runs
 * again. Answers that arrive after the page moved on are ignored.
 */
export function useAdminResource<T>(key: string, load: () => Promise<T>, isNotFound?: (error: unknown) => boolean) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ tag: string; state: ResourceState<T> } | null>(null)
  const loadRef = useRef(load)
  const notFoundRef = useRef(isNotFound)
  const tag = `${key}#${attempt}`

  useEffect(() => {
    loadRef.current = load
    notFoundRef.current = isNotFound
  })

  useEffect(() => {
    let cancelled = false
    loadRef
      .current()
      .then((data) => !cancelled && setResult({ tag, state: { status: 'ready', data } }))
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({ tag, state: notFoundRef.current?.(error) ? { status: 'not-found' } : { status: 'error', error } })
      })
    return () => {
      cancelled = true
    }
  }, [tag])

  const state: ResourceState<T> = result?.tag === tag ? result.state : { status: 'loading' }
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  /** Replace the loaded data after a change, without loading again. */
  const setData = useCallback((data: T) => setResult({ tag, state: { status: 'ready', data } }), [tag])

  return { state, retry, setData }
}
