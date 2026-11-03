// Audit log for the admin console (FR-ADM-04).
//
// One row for every administrative action that creates, changes or deletes data: which admin,
// what they did, to which record, and when. The server writes it, from the signed-in admin's
// session, and it is never edited or deleted, so the console only reads it. While the console
// runs on sample data, the sample modules (adminEventsApi, venuesApi, ordersApi, usersApi) play
// the server's part and call `record()` after each change. When the API exists, `record()` goes
// away and `auditApi.list()` reads GET /api/admin/audit-log.

import { now } from './adminTime.ts'

export type AuditTarget = 'event' | 'venue' | 'order' | 'refund' | 'user'

export type AuditAction =
  | 'created'
  | 'updated'
  | 'published'
  | 'cancelled'
  | 'deleted'
  | 'restored'
  | 'ticketsChanged'
  | 'refunded'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'unblocked'
  | 'roleChanged'

export type AuditEntry = {
  id: string
  at: string
  /** The admin who acted. */
  actor: string
  action: AuditAction
  target: { type: AuditTarget; id: string; label: string }
  /** What they wrote or chose: a reason, a note, the new role. */
  detail?: string
  /** Money moved by the action, in EGP. */
  amount?: number
  /** Tickets affected by the action. */
  tickets?: number
}

// The history behind the sample data, oldest first.
const SEED: Omit<AuditEntry, 'id'>[] = [
  { at: '2026-03-14T10:31', actor: 'Hafletna Admin', action: 'roleChanged', target: { type: 'user', id: '2a7f5e1b-3c8d-4b9e-9f0a-1b2c3d4e5f61', label: 'Nadine Farouk' }, detail: 'admin' },
  { at: '2026-08-28T13:10', actor: 'Nadine Farouk', action: 'created', target: { type: 'event', id: 'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45', label: 'Red Sea Beach Run' } },
  { at: '2026-09-01T10:00', actor: 'Hafletna Admin', action: 'created', target: { type: 'event', id: 'c5d1e3a0-2b5f-4c0d-9e43-7f8a9b0c1d23', label: 'Stand-Up Friday' } },
  { at: '2026-09-02T10:00', actor: 'Nadine Farouk', action: 'published', target: { type: 'event', id: 'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45', label: 'Red Sea Beach Run' } },
  { at: '2026-09-03T12:00', actor: 'Hafletna Admin', action: 'published', target: { type: 'event', id: 'c5d1e3a0-2b5f-4c0d-9e43-7f8a9b0c1d23', label: 'Stand-Up Friday' } },
  { at: '2026-09-12T11:20', actor: 'Hafletna Admin', action: 'created', target: { type: 'event', id: '4f2a9c1e-7b3d-4e8a-9c21-5d6e7f8a9b01', label: 'Cairo Jazz Night' } },
  { at: '2026-09-15T14:05', actor: 'Nadine Farouk', action: 'created', target: { type: 'event', id: '8b3c0d2f-1a4e-4b9c-8d32-6e7f8a9b0c12', label: 'Sunset Beats' } },
  { at: '2026-09-18T09:00', actor: 'Hafletna Admin', action: 'published', target: { type: 'event', id: '4f2a9c1e-7b3d-4e8a-9c21-5d6e7f8a9b01', label: 'Cairo Jazz Night' } },
  { at: '2026-09-22T09:45', actor: 'Nadine Farouk', action: 'created', target: { type: 'event', id: 'd6e2f4b1-3c6a-4d1e-8f54-8a9b0c1d2e34', label: 'Acoustic Nights' } },
  { at: '2026-09-24T16:30', actor: 'Nadine Farouk', action: 'published', target: { type: 'event', id: '8b3c0d2f-1a4e-4b9c-8d32-6e7f8a9b0c12', label: 'Sunset Beats' } },
  { at: '2026-09-30T18:00', actor: 'Nadine Farouk', action: 'published', target: { type: 'event', id: 'd6e2f4b1-3c6a-4d1e-8f54-8a9b0c1d2e34', label: 'Acoustic Nights' } },
  {
    at: '2026-10-08T15:40',
    actor: 'Nadine Farouk',
    action: 'cancelled',
    target: { type: 'event', id: 'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45', label: 'Red Sea Beach Run' },
    detail: 'The city did not renew the permit for the coastal road, so the run was cancelled and every ticket refunded.',
    tickets: 600,
  },
  {
    at: '2026-10-10T12:00',
    actor: 'Nadine Farouk',
    action: 'blocked',
    target: { type: 'user', id: '8a3f1e7b-9c4d-4b5e-9f6a-7b8c9d0e1fc7', label: 'Karim Fathy' },
    detail: 'Several orders paid with cards that were later reported stolen. Blocked until the bank finishes its review.',
    tickets: 0,
  },
  { at: '2026-10-12T16:20', actor: 'Nadine Farouk', action: 'rejected', target: { type: 'refund', id: 'RR-2039', label: 'RR-2039' }, detail: 'Requested four days before the show; refunds close seven days before.' },
  {
    at: '2026-10-13T10:05',
    actor: 'Nadine Farouk',
    action: 'refunded',
    target: { type: 'order', id: 'HF-10238', label: 'HF-10238' },
    detail: 'The customer can’t attend anymore because of a family emergency and asked for a refund.',
    amount: 900,
    tickets: 1,
  },
  { at: '2026-10-14T16:25', actor: 'Hafletna Admin', action: 'created', target: { type: 'event', id: 'f8a4b6d3-5e8c-4f3a-8b76-0c1d2e3f4a56', label: 'Alexandria Film Week' } },
  {
    at: '2026-10-15T09:45',
    actor: 'Hafletna Admin',
    action: 'blocked',
    target: { type: 'user', id: '1d6c4b0e-2f7a-4e8b-8c9d-0e1f2a3b4cfa', label: 'Rana Magdy' },
    detail: 'Reselling transferred tickets above face value on social media.',
    tickets: 0,
  },
  { at: '2026-10-17T10:40', actor: 'Hafletna Admin', action: 'created', target: { type: 'event', id: '0a9b7c4e-6f9d-4a4b-9c87-1d2e3f4a5b67', label: 'Startup Summit Cairo' } },
  { at: '2026-10-18T12:15', actor: 'Nadine Farouk', action: 'created', target: { type: 'event', id: '1b0c8d5f-7a0e-4b5c-8d98-2e3f4a5b6c78', label: 'Pottery by the Nile' } },
]

let count = 0
const nextId = () => `AL-${String(++count).padStart(5, '0')}`

let LOG: AuditEntry[] = SEED.map((e) => ({ id: nextId(), ...e }))

/** Who the sample "server" records as acting: the signed-in admin, set by the console layout. */
let acting = 'Hafletna Admin'

export function actAs(name: string) {
  acting = name
}

/** The signed-in admin's name, for data functions called without one. */
export function actingAdmin() {
  return acting
}

/** Adds one row. Only the sample data modules call this; the real server writes its own log. */
export function record(action: AuditAction, target: AuditEntry['target'], extra: { detail?: string; amount?: number; tickets?: number; actor?: string } = {}) {
  const { actor, ...rest } = extra
  LOG = [...LOG, { id: nextId(), at: now(), actor: actor || acting, action, target, ...rest }]
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const auditApi = {
  /** Every entry, newest first. Read only: there is no way to change or remove one. */
  async list(): Promise<AuditEntry[]> {
    await delay(300)
    return [...LOG].reverse()
  },
}
