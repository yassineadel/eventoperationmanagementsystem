import { deleteJson, patchJson, postJson } from './api'
import type { AuthUser } from './authApi'

type UserResult = { user: AuthUser & { phone: string | null; emailVerified?: boolean } }
type DeletionResult = { deletionRequestedAt: string; deletesAt: string }
export const profileApi = {
  updateDetails: (fullName: string, phone: string, signal?: AbortSignal) =>
    patchJson<UserResult>('/api/auth/me', { fullName: fullName.trim(), phone: phone.trim() }, { signal }),
  changePassword: (currentPassword: string, newPassword: string, signal?: AbortSignal) =>
    postJson<{ message: string }>('/api/auth/change-password', { currentPassword, newPassword }, { signal }),
  requestEmail: (newEmail: string, signal?: AbortSignal) =>
    postJson<{ message: string }>('/api/auth/change-email/request', { newEmail: newEmail.trim().toLowerCase() }, { signal }),
  verifyEmail: (code: string, signal?: AbortSignal) =>
    postJson<UserResult>('/api/auth/change-email/verify', { code }, { signal }),
  preferences: (marketingOptIn: boolean, signal?: AbortSignal) =>
    patchJson<{ marketingOptIn: boolean }>('/api/auth/me/preferences', { marketingOptIn }, { signal }).then((result) => {
      if (typeof result.marketingOptIn !== 'boolean') throw new Error('Invalid account preference response')
      return result
    }),
  requestDeletion: (confirmEmail: string, signal?: AbortSignal) =>
    postJson<DeletionResult>('/api/auth/me/deletion', { confirmEmail: confirmEmail.trim().toLowerCase() }, { signal }).then((result) => {
      if (typeof result.deletionRequestedAt !== 'string' || typeof result.deletesAt !== 'string'
        || !Number.isFinite(Date.parse(result.deletionRequestedAt)) || !Number.isFinite(Date.parse(result.deletesAt))
        || Date.parse(result.deletesAt) < Date.parse(result.deletionRequestedAt)) throw new Error('Invalid deletion request response')
      return result
    }),
  cancelDeletion: (signal?: AbortSignal) => deleteJson<{ message: string }>('/api/auth/me/deletion', { signal }),
}
