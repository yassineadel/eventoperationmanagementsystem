import type { SessionUser } from '../../lib/sessionUser.ts'
import { validAttendee, type Selection } from './bookingModel.ts'

export function resolveAttendeeNames(items: Selection[], entered: Record<string, string>, account: Pick<SessionUser, 'fullName' | 'email'> | null) {
  const accountName = account?.fullName.trim() ?? ''
  // A session may use its email as a display-name fallback; that is not an attendee name.
  const defaultName = validAttendee(accountName) && !accountName.includes('@') ? accountName : ''
  return Object.fromEntries(items.map((item, index) => [item.key, entered[item.key] ?? (index === 0 ? defaultName : '')]))
}
