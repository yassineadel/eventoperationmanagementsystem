// Small fetch wrapper for the Hafletna API.
// Cookies carry the session (httpOnly JWT set by the backend), so every call sends credentials.

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export type FieldError = { field: string; message: string }

export class ApiError extends Error {
  status: number
  fieldErrors: FieldError[]

  constructor(message: string, status: number, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  // status 0 means the request never reached the server
  get isNetwork() {
    return this.status === 0
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init })
  } catch {
    throw new ApiError('Network error', 0)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'Request failed'
    const fieldErrors = Array.isArray(data?.errors) ? (data.errors as FieldError[]) : []
    throw new ApiError(message, res.status, fieldErrors)
  }
  return data as T
}

export function postJson<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getJson<T>(path: string, init: Pick<RequestInit, 'signal'> = {}) {
  return request<T>(path, { method: 'GET', ...init })
}
