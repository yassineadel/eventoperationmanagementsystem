import { useOutletContext } from 'react-router-dom'
import type { Profile } from './profileModel'

export type ProfileContext = { profile: Profile; preview: boolean; updatePreview: (patch: Partial<Profile>) => boolean }
export function useProfile() { return useOutletContext<ProfileContext>() }
