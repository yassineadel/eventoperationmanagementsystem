import { ApiError } from '../../lib/api'
import type { Strings } from './strings'

// Turns any thrown error into a message for the person using the page.
// Known server messages are matched in each page; this covers the rest.
export function friendlyError(err: unknown, t: Strings): string {
  if (err instanceof ApiError) {
    if (err.isNetwork) return t.errNetwork
    if (err.status === 429) return t.tooMany
    if (err.status >= 500) return t.errGeneric
    return err.message || t.errGeneric
  }
  return t.errGeneric
}

// Field-level messages the server returned for a 400 validation failure
export function serverFieldError(err: unknown, field: string): string | null {
  if (!(err instanceof ApiError)) return null
  return err.fieldErrors.find((e) => e.field === field)?.message ?? null
}

export function isServerMessage(err: unknown, ...messages: string[]) {
  return err instanceof ApiError && messages.some((m) => err.message.startsWith(m))
}
