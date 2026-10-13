// Client-side checks mirror Backend/src/modules/auth/auth.schemas.ts so users see
// problems before the request. The server still validates everything.

export const CODE_LENGTH = 6

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^01[0125][0-9]{8}$/

export function isEmail(value: string) {
  return EMAIL_RE.test(value.trim())
}

export function isPhone(value: string) {
  return PHONE_RE.test(value.trim())
}

export function isFullName(value: string) {
  const length = value.trim().length
  return length >= 2 && length <= 200
}

export function isCode(value: string) {
  return value.length === CODE_LENGTH && /^[0-9]+$/.test(value)
}

export type PasswordChecks = { length: boolean; upper: boolean; lower: boolean; number: boolean }

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }
}

export function isStrongPassword(password: string) {
  const checks = passwordChecks(password)
  return checks.length && checks.upper && checks.lower && checks.number
}
