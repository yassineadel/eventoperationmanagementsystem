import { API_URL, getJson, postJson } from './api'

// Request bodies match Backend/src/modules/auth/auth.schemas.ts
export type RegisterInput = {
  fullName: string
  email: string
  password: string
  phone?: string
}

export type AuthUser = {
  id: string
  fullName: string
  email: string
  role: string
}

type MessageResponse = { message: string }

export const authApi = {
  register: (input: RegisterInput) => postJson<MessageResponse>('/api/auth/register', input),
  verifyEmail: (email: string, code: string) =>
    postJson<MessageResponse>('/api/auth/verify-email', { email, code }),
  login: (email: string, password: string) =>
    postJson<MessageResponse & { user: AuthUser }>('/api/auth/login', { email, password }),
  forgotPassword: (email: string) => postJson<MessageResponse>('/api/auth/forgot-password', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    postJson<MessageResponse>('/api/auth/reset-password', { email, code, newPassword }),
  me: (signal?: AbortSignal) => getJson<{ user: AuthUser }>('/api/auth/me', { signal }),
  logout: () => postJson<MessageResponse>('/api/auth/logout', {}),
  googleUrl: `${API_URL}/api/auth/google`,
}

// The API has no "resend verification code" endpoint: registering again with the same
// details sends a fresh code. We keep those details in memory only (never in storage or
// the URL) so the Verify page can resend. A page refresh forgets them by design.
let pendingRegistration: RegisterInput | null = null

export function rememberRegistration(input: RegisterInput) {
  pendingRegistration = input
}

export function pendingRegistrationFor(email: string) {
  if (!pendingRegistration) return null
  return pendingRegistration.email.toLowerCase() === email.trim().toLowerCase() ? pendingRegistration : null
}

export function clearPendingRegistration() {
  pendingRegistration = null
}
