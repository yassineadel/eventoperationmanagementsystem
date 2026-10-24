import { isCode, isEmail, isFullName, isPhone, isStrongPassword } from '../../lib/validation.ts'

export type CommunicationPreferences = { eventNews: boolean; personalisedOffers: boolean }
export type Profile = { fullName: string; phone: string; email: string; emailVerified: boolean | null; communications: CommunicationPreferences; deletionRequestedAt: string | null; marketingOptIn?: boolean | null }
export const previewStorageKey = 'hafletna.profile-preview'
export const previewPassword = 'HafletnaDemo1'
export const defaultPreviewProfile: Profile = {
  fullName: 'Youssef Hassan', phone: '01012345678', email: 'youssef@example.com', emailVerified: true,
  communications: { eventNews: false, personalisedOffers: false }, deletionRequestedAt: null,
}
export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>
export function browserProfileStorage(): ProfileStorage | undefined {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined } catch { return undefined }
}
export function readPreviewProfile(storage = browserProfileStorage()): Profile {
  const fallback = () => ({ ...defaultPreviewProfile, communications: { ...defaultPreviewProfile.communications } })
  try {
    const raw = JSON.parse(storage?.getItem(previewStorageKey) ?? 'null')
    if (!raw || typeof raw !== 'object') return fallback()
    return {
      fullName: typeof raw.fullName === 'string' && isFullName(raw.fullName) ? raw.fullName.trim() : defaultPreviewProfile.fullName,
      phone: raw.phone === '' || typeof raw.phone === 'string' && isPhone(raw.phone) ? raw.phone.trim() : defaultPreviewProfile.phone,
      email: typeof raw.email === 'string' && isEmail(raw.email) ? raw.email.trim() : defaultPreviewProfile.email,
      emailVerified: true,
      communications: { eventNews: raw.communications?.eventNews === true, personalisedOffers: raw.communications?.personalisedOffers === true },
      deletionRequestedAt: typeof raw.deletionRequestedAt === 'string' && Number.isFinite(Date.parse(raw.deletionRequestedAt)) ? raw.deletionRequestedAt : null,
    }
  } catch { return fallback() }
}
export function writePreviewProfile(profile: Profile, storage = browserProfileStorage()): boolean {
  if (!storage) return false
  try {
    // Explicit fields prevent passwords, verification codes, and session data from being persisted.
    storage.setItem(previewStorageKey, JSON.stringify({
      fullName: profile.fullName, phone: profile.phone, email: profile.email,
      communications: { eventNews: profile.communications.eventNews === true, personalisedOffers: profile.communications.personalisedOffers === true },
      deletionRequestedAt: profile.deletionRequestedAt,
    }))
    return true
  } catch { return false }
}
export function validateDetails(fullName: string, phone: string) {
  return { fullName: !isFullName(fullName), phone: Boolean(phone.trim()) && !isPhone(phone) }
}
export function validatePasswordChange(current: string, password: string, confirm: string) {
  return { current: current.length === 0, password: !isStrongPassword(password) || password === current, confirm: password !== confirm }
}
export type EmailChange = { email: string; code: string; expiresAt: number; resendAt: number; attempts: number }
export function beginEmailChange(current: string, next: string, now = Date.now()): EmailChange | null {
  if (!isEmail(next) || current.trim().toLowerCase() === next.trim().toLowerCase()) return null
  // This code is displayed on-screen for the explicitly labelled sample flow, never used for real verification.
  return { email: next.trim(), code: String(Math.floor(100000 + Math.random() * 900000)), expiresAt: now + 5 * 60_000, resendAt: now + 30_000, attempts: 0 }
}
export function verifySampleEmail(change: EmailChange, code: string, now = Date.now()) {
  if (now >= change.expiresAt) return { status: 'expired' as const, change }
  if (change.attempts >= 5) return { status: 'locked' as const, change }
  if (!isCode(code) || change.code !== code) {
    const next = { ...change, attempts: change.attempts + 1 }
    return { status: next.attempts >= 5 ? 'locked' as const : 'invalid' as const, change: next }
  }
  return { status: 'verified' as const, change }
}
export function canRequestDeletion(email: string, confirmation: string, acknowledged: boolean) {
  return acknowledged && confirmation.trim().toLowerCase() === email.trim().toLowerCase()
}

// GET /me returns the request timestamp; the backend defines a 14-day grace period.
// Used only to display the deadline after a reload, never to delete an account.
export function deletionGraceEnds(requestedAt: string | null): string | null {
  const timestamp = requestedAt ? Date.parse(requestedAt) : NaN
  return Number.isFinite(timestamp) ? new Date(timestamp + 14 * 24 * 60 * 60 * 1000).toISOString() : null
}
