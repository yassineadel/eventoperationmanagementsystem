// Calls to the backend's admin API (/api/admin). Everything the console shows comes from here,
// so every page reflects the database; every change is sent here and the page reloads from it.
import { API_URL, ApiError } from '../../lib/api'

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/admin${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(typeof data?.message === 'string' ? data.message : 'Request failed', res.status)
  return data as T
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => call<T>('PATCH', path, body),
  del: <T>(path: string) => call<T>('DELETE', path),
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageCount: number }

// ── shapes the admin API returns (only the fields the console uses) ──
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
export type TicketStatus = 'VALID' | 'USED' | 'REFUNDED' | 'VOID'
export type RefundStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SETTLED'

export type EventRow = {
  id: string; name: string; category: string; performer: string | null; status: EventStatus; startAt: string; images: string[]
  venue: { id: string; name: string; city: string; type: 'SEATED' | 'STANDING' }
  sold: number; capacity: number; fromPrice: number | null; isPast: boolean
}
export type TicketCategory = {
  id: string; categoryKey: string; name: string; description: string | null; price: string; serviceFeePercent: string; capacity: number; soldCount: number; heldCount: number
}
export type EventDetail = EventRow & {
  description: string; about: string | null; doorsOpenAt: string; durationMinutes: number; salesOpenAt: string | null; salesCloseAt: string | null
  cancellationReason: string | null; publishedAt: string | null; createdAt: string
  policies: Record<string, { en?: string } | undefined> | null
  venue: EventRow['venue'] & { slug: string; capacity: number }
  ticketCategories: TicketCategory[]
  createdBy: { fullName: string }
  staffAssignments: { id: string; staff: { id: string; fullName: string; username: string } }[]
  stats: { revenue: number; orders: Partial<Record<OrderStatus, number>>; tickets: Partial<Record<TicketStatus, number>> }
  availableCategories: { key: string; label: string; color: string | null; capacity: number }[]
}
export type OrderRow = {
  id: string; reference: string; status: OrderStatus; total: string; createdAt: string; paidAt: string | null; tickets: number
  user: { id: string; fullName: string; email: string }; event: { id: string; name: string }; payment: { provider: string; status: string } | null
}
export type TicketRow = {
  id: string; attendeeName: string; status: TicketStatus; transferCount: number; createdAt: string; usedAt: string | null
  event: { id: string; name: string; startAt: string }; ticketCategory: { name: string }
  seat: { section: string; row: string; number: number } | null
  holder: { id: string; fullName: string; email: string }; orderItem: { order: { id: string; reference: string } }
}
export type RefundRow = {
  id: string; status: RefundStatus; type: string; amount: string; serviceFeeRetained: string; reason: string | null; rejectionReason: string | null
  createdAt: string; reviewedAt: string | null; settledAt: string | null
  payee: { id: string; fullName: string; email: string }; reviewedBy: { fullName: string } | null
  ticket: { id: string; attendeeName: string; event: { id: string; name: string; startAt: string }; ticketCategory: { name: string }; orderItem: { order: { reference: string } } }
}
export type UserRow = {
  id: string; fullName: string; email: string; phone: string | null; role: 'USER' | 'ADMIN'; isBlocked: boolean; blockedReason: string | null
  createdAt: string; google: boolean; orders: number; tickets: number; spent: number
}
export type VenueRow = {
  id: string; slug: string; name: string; type: 'SEATED' | 'STANDING'; address: string; city: string; capacity: number
  latitude: string; longitude: string; image: string | null; mapUrl: string | null; events: number; published: number
}
export type Lookups = { categories: string[]; cities: string[]; venues: { id: string; name: string; city: string; type: string; capacity: number }[]; events: { id: string; name: string; startAt: string }[] }
