import { useEffect, useRef, useState } from 'react'
import { usePreferences } from '../Auth/preferences'
import { ApiError } from '../../lib/api'
import { profileStrings } from './strings'
import { accountErrorKey } from './accountErrors'

// Keep duplicate submissions out and ignore completions after navigation/unmount.
// An aborted mutation can still have reached the server; never retry automatically.
export function useAccountAction() {
  const { lang } = usePreferences()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<typeof accountErrorKey> | 'requestTimeout' | ''>('')
  const pending = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; pending.current?.abort() }
  }, [])
  async function run<T>(task: (signal: AbortSignal) => Promise<T>, success: (result: T) => void) {
    if (pending.current || !mounted.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true); setError('')
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const result = await task(controller.signal)
      if (mounted.current && !controller.signal.aborted) success(result)
    } catch (failure) {
      if (mounted.current) setError(controller.signal.aborted ? 'requestTimeout' : accountErrorKey(failure instanceof ApiError ? failure : null))
    } finally {
      window.clearTimeout(timeout)
      pending.current = null
      if (mounted.current) setBusy(false)
    }
  }
  return { busy, error, errorText: error ? profileStrings[lang][error] : '', clearError: () => setError(''), run }
}
