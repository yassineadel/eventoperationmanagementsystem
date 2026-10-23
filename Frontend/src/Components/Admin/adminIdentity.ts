import { useMemo } from 'react'
import { SAMPLE_ADMIN, type Actor } from '../../lib/usersApi'
import { useSession } from '../Auth/sessionContext'

/** The admin using the console: the signed-in user, or the sample admin in preview. */
export function useAdminActor(): Actor & { preview: boolean } {
  const { user } = useSession()
  return useMemo(
    () => (user ? { id: user.id, email: user.email, name: user.fullName, preview: false } : { ...SAMPLE_ADMIN, preview: true }),
    [user],
  )
}
