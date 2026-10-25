// Match the current auth service contract, never expose untranslated server text.
export function accountErrorKey(error: { status: number; message: string } | null) {
  if (!error) return 'requestFailed' as const
  if (error.status === 0) return 'requestNetwork' as const
  if (error.status === 401 || error.status === 403) return 'sessionExpired' as const
  if (error.status === 429) return 'requestLimited' as const
  const message = error.message.toLowerCase()
  if (message.includes('current password is incorrect')) return 'incorrectPassword' as const
  if (message.includes('signs in with google')) return 'googlePassword' as const
  if (message.includes('different from the current')) return 'passwordError' as const
  if (message.includes('email already in use') || message.includes('unique constraint')) return 'emailTaken' as const
  if (message.includes('already your email')) return 'sameEmail' as const
  if (message.includes('expired or not requested')) return 'expiredCode' as const
  if (message.includes('invalid verification code')) return 'invalidCode' as const
  if (message.includes('email you typed does not match')) return 'deletionError' as const
  if (message.includes('deletion has already been requested')) return 'deletionAlreadyRequested' as const
  if (message.includes('no deletion request to cancel')) return 'deletionNotPending' as const
  return 'requestFailed' as const
}
