export type SessionUser = {
  id: string
  fullName: string
  email: string
  role: string
  phone: string
  emailVerified: boolean | null
}

export function normaliseSessionUser(value: unknown): SessionUser {
  if (!value || typeof value !== 'object') throw new Error('Invalid session')
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id || typeof raw.email !== 'string' || !raw.email) throw new Error('Invalid session')
  const fullName = typeof raw.fullName === 'string' ? raw.fullName.trim()
    : [raw.first_name, raw.last_name].filter((part) => typeof part === 'string').join(' ').trim()
  const verified = raw.emailVerified ?? raw.isVerified ?? raw.is_verified
  return {
    id: raw.id, fullName: fullName || raw.email, email: raw.email,
    role: typeof raw.role === 'string' ? raw.role : 'customer',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    emailVerified: typeof verified === 'boolean' ? verified : null,
  }
}

export function accountReturnPath(value: string | null): string {
  return value === '/profile' || value === '/profile/settings' ? value : '/'
}

const returnKey = 'hafletna.auth-return'
export function rememberAccountReturn(value: string) {
  try { sessionStorage.setItem(returnKey, accountReturnPath(value)) } catch { /* Navigation still works without browser storage. */ }
}
export function takeAccountReturn() {
  try {
    const value = sessionStorage.getItem(returnKey)
    sessionStorage.removeItem(returnKey)
    return accountReturnPath(value)
  } catch { return '/' }
}
