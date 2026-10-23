import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * List filters kept in the URL (?q=&status=&event=…), so they survive Back, can be
 * shared as links and can be opened pre-filtered from other pages. Values equal to the
 * default are left out of the URL. Typing in the search box replaces the history entry;
 * other filter changes add one. Pass a constant object so its identity stays stable.
 */
export function useListParams<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams()
  const keys = Object.keys(defaults) as K[]
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? defaults[k]])) as Record<K, string>

  const set = useCallback(
    (key: K, value: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === '' || value === defaults[key]) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: key === 'q' },
      ),
    [setParams, defaults],
  )

  const clear = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const k of Object.keys(defaults)) next.delete(k)
        return next
      }),
    [setParams, defaults],
  )

  return { values, set, clear }
}

/** A URL value narrowed to one of the allowed choices, or the fallback. */
export function oneOf<V extends string>(value: string, choices: readonly V[], fallback: V): V {
  return (choices as readonly string[]).includes(value) ? (value as V) : fallback
}
