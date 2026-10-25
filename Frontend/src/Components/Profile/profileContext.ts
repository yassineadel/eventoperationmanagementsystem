import { useOutletContext } from 'react-router-dom'
import type { Profile } from './profileModel'
import type { SessionUser } from '../../lib/sessionUser'

export type ProfileContext = { profile: Profile; updateAccount: (patch: Partial<SessionUser>) => void }
export function useProfile() { return useOutletContext<ProfileContext>() }
