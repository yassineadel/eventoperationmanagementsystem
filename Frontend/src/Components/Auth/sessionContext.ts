import { createContext, useContext } from 'react'
import type { SessionUser } from '../../lib/sessionUser'

export type SessionState = { status: 'loading' | 'authenticated' | 'guest' | 'unavailable'; user: SessionUser | null }
export type Session = SessionState & {
  acceptUser: (user: unknown) => void
  updateUser: (userId: string, patch: Partial<SessionUser>) => void
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
export const SessionContext = createContext<Session>({
  status: 'guest', user: null, acceptUser() {}, updateUser() {}, async refresh() {}, async signOut() {},
})
export function useSession() { return useContext(SessionContext) }
