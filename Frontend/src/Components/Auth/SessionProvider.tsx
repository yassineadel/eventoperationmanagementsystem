import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { authApi } from '../../lib/authApi'
import { ApiError } from '../../lib/api'
import { normaliseSessionUser, type SessionUser } from '../../lib/sessionUser'
import { SessionContext, type SessionState } from './sessionContext'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null })
  const request = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const acceptUser = useCallback((raw: unknown) => {
    const user = normaliseSessionUser(raw)
    request.current += 1
    controller.current?.abort()
    setState({ status: 'authenticated', user })
  }, [])

  const updateUser = useCallback((userId: string, patch: Partial<SessionUser>) => {
    request.current += 1
    controller.current?.abort()
    setState((current) => current.status === 'authenticated' && current.user?.id === userId
      ? { status: 'authenticated', user: normaliseSessionUser({ ...current.user, ...patch, id: userId }) }
      : current)
  }, [])

  const loadSession = useCallback(async (): Promise<{ id: number; state: SessionState }> => {
    const id = ++request.current
    controller.current?.abort()
    const pending = new AbortController()
    controller.current = pending
    const timeout = window.setTimeout(() => pending.abort(), 8000)
    try {
      const { user } = await authApi.me(pending.signal)
      const normalised = normaliseSessionUser(user)
      return { id, state: { status: 'authenticated', user: normalised } }
    } catch (error) {
      return { id, state: { status: error instanceof ApiError && [401, 403].includes(error.status) ? 'guest' : 'unavailable', user: null } }
    } finally { window.clearTimeout(timeout) }
  }, [])

  const refresh = useCallback(async () => {
    setState({ status: 'loading', user: null })
    const result = await loadSession()
    if (result.id === request.current) setState(result.state)
  }, [loadSession])

  const signOut = useCallback(async () => {
    await authApi.logout()
    request.current += 1
    controller.current?.abort()
    setState({ status: 'guest', user: null })
  }, [])

  useEffect(() => {
    void loadSession().then((result) => {
      if (result.id === request.current) setState(result.state)
    })
    return () => { request.current += 1; controller.current?.abort() }
  }, [loadSession])

  const value = useMemo(() => ({ ...state, acceptUser, updateUser, refresh, signOut }), [state, acceptUser, updateUser, refresh, signOut])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
