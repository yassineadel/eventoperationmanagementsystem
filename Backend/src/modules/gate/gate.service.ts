import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { env } from '../../config/env'
import { guardTx } from '../../utils/guardTx'
import type { ScanRejectReason, StaffRole } from '@prisma/client'

// An error that carries the HTTP status to send back (401, 403…)
export class GateError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const login = async (username: string, password: string) => {
  // 1. Find the staff member
  const staff = await prisma.staffAccount.findUnique({ where: { username } })

  // 2. Check the password against the stored hash.
  //    Same message for "no such user" and "wrong password", so an attacker
  //    can't find out which usernames exist.
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
    throw new GateError('Wrong username or password', 401)
  }

  // 3. Blocked staff can't log in (FR-APP-07)
  if (staff.isBlocked) {
    throw new GateError('This staff account is blocked', 403)
  }

  // 4. Make the token. typ: 'gate' marks it as a staff token, not a website-user token.
  const token = jwt.sign({ typ: 'gate', staffId: staff.id }, env.JWT_SECRET, { expiresIn: '14h' })

  // 5. Send back the token and some basic info. Never send the password hash.
  return {
    token,
    staff: { id: staff.id, fullName: staff.fullName, role: staff.role },
  }
}

/**
 * The staff member's details, for GET /api/gate/me
 */
export const getStaff = async (staffId: string) => {
  const staff = await prisma.staffAccount.findUnique({
    where: { id: staffId },
    select: { id: true, fullName: true, username: true, role: true },
  })
  if (!staff) throw new GateError('Staff account not found', 404)
  return staff
}

/**
 * An assignment is active when it is not revoked and "now" is inside its validFrom/validUntil window
 * (an empty side of the window means no limit). Used by the events list and by scanning, so both follow one rule.
 */
const activeAssignment = (staffId: string, now: Date): Prisma.StaffEventAssignmentWhereInput => ({
  staffId,
  revokedAt: null,
  AND: [
    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
    { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
  ],
})

/**
 * The events this staff member can scan: assigned ones for scanners, all for app admins.
 * Only events that haven't ended yet. No prices (FR-APP-08).
 */
export const getAssignedEvents = async (staffId: string, role: StaffRole) => {
  const now = new Date()
  // An event that started up to a day ago may still be running; the exact end is checked below
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const events = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      startAt: { gte: oneDayAgo },
      // App admins see every event; scanners only those they are assigned to, while the assignment is active
      ...(role === 'APP_ADMIN' ? {} : { staffAssignments: { some: activeAssignment(staffId, now) } }),
    },
    select: { id: true, name: true, startAt: true, durationMinutes: true, venue: { select: { name: true, type: true } } },
    orderBy: { startAt: 'asc' },
  })

  return events
    // ends = start + duration; drop the ones already over
    .filter((e) => e.startAt.getTime() + e.durationMinutes * 60_000 >= now.getTime())
    .map((e) => ({ id: e.id, name: e.name, venueName: e.venue.name, startAt: e.startAt, seated: e.venue.type === 'SEATED' }))
}

// ─── Scanning ───────────────────────────────────────────────────────────────

/**
 * What the gate app gets back after a scan (same shape as ScanResponse in Scanner/src/api/types.ts).
 * Never any prices or money (FR-APP-08).
 */
export type ScanResponse =
  | { result: 'ACCEPTED'; attendeeName: string; category: string; seat?: string }
  | { result: 'REJECTED'; reason: ScanRejectReason; usedAt?: Date }

export interface ScanInput {
  staffId: string
  role: StaffRole
  clientScanId: string
  eventId: string
  code: string
  deviceIdentifier: string
}

// The ticket fields a scan needs: enough to decide, and to show the name, category and seat
const scanTicketSelect = {
  id: true,
  eventId: true,
  status: true,
  usedAt: true,
  attendeeName: true,
  event: { select: { status: true } },
  ticketCategory: { select: { name: true } },
  seat: { select: { section: true, row: true, number: true } },
} as const

type ScanTicket = Prisma.TicketGetPayload<{ select: typeof scanTicketSelect }>

// A readable seat label for the gate screen, e.g. "ORC-A-5" (section-row-number)
const seatLabel = (s: { section: string; row: string; number: number }) => `${s.section}-${s.row}-${s.number}`

const accepted = (t: ScanTicket): ScanResponse => ({
  result: 'ACCEPTED',
  attendeeName: t.attendeeName,
  category: t.ticketCategory.name,
  // standing tickets have no seat, so the field is left out
  ...(t.seat ? { seat: seatLabel(t.seat) } : {}),
})

const rejected = (reason: ScanRejectReason, ticket?: ScanTicket | null): ScanResponse => ({
  result: 'REJECTED',
  reason,
  // For "already used", also say when, so the gate can tell the guest
  ...(reason === 'ALREADY_USED' && ticket?.usedAt ? { usedAt: ticket.usedAt } : {}),
})

/**
 * Why this ticket cannot get in, checked in a fixed order; null means it may be admitted.
 * There is no TRANSFERRED_AWAY check: a transfer replaces the QR code and the old one is not kept,
 * so an old code finds no ticket and is answered INVALID.
 */
const rejectReasonFor = (t: ScanTicket, eventId: string): ScanRejectReason | null => {
  if (t.eventId !== eventId) return 'WRONG_EVENT'
  if (t.event.status === 'CANCELLED' || t.status === 'VOID') return 'EVENT_CANCELLED'
  if (t.status === 'REFUNDED') return 'REFUNDED'
  if (t.status === 'USED') return 'ALREADY_USED'
  return null
}

/**
 * Answer a scan that was already saved, by rebuilding its result from the saved record.
 * The app re-sends a scan after a network error; the second copy must change nothing.
 */
const replayScan = async (clientScanId: string, staffId: string): Promise<ScanResponse> => {
  const record = await prisma.scanRecord.findUniqueOrThrow({
    where: { clientScanId },
    select: { staffId: true, result: true, rejectReason: true, ticket: { select: scanTicketSelect } },
  })
  // Scan ids are made on each device, so another staff member using the same id is a mistake.
  // Refuse it instead of showing them someone else's scan.
  if (record.staffId !== staffId) throw new GateError('This scan id has already been used', 409)

  if (record.result === 'ACCEPTED' && record.ticket) return accepted(record.ticket)
  return rejected(record.rejectReason ?? 'INVALID', record.ticket)
}

// True when the insert failed because this clientScanId is already in scan_records (unique column)
const isDuplicateScanId = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

/**
 * POST /api/gate/scan: check a QR code at the gate and admit the ticket if it is valid.
 * Every scan, accepted or rejected, is saved in scan_records (FR-APP-15).
 */
export const scanTicket = async (input: ScanInput): Promise<ScanResponse> => {
  const { staffId, role, clientScanId, eventId, code, deviceIdentifier } = input
  const now = new Date()

  // 1. Permission: scanners need an active assignment to this event; app admins can scan any event
  if (role === 'APP_ADMIN') {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } })
    if (!event) throw new GateError('Event not found', 404)
  } else {
    const assignment = await prisma.staffEventAssignment.findFirst({
      where: { ...activeAssignment(staffId, now), eventId },
      select: { id: true },
    })
    if (!assignment) throw new GateError('You are not assigned to this event', 403)
  }

  // 2. Same scan sent again (after a network error): give the same answer and change nothing
  const previous = await prisma.scanRecord.findUnique({ where: { clientScanId }, select: { id: true } })
  if (previous) return replayScan(clientScanId, staffId)

  // 3. The device that scanned. Created the first time we see it, and we note when it was last used.
  // TODO: refuse scans from devices that are not activated (FR-APP-05/06). Separate task.
  const device = await prisma.device.upsert({
    where: { deviceIdentifier },
    create: { deviceIdentifier, lastSeenAt: now },
    update: { lastSeenAt: now },
    select: { id: true },
  })

  // 4. Find the ticket by its QR code and decide
  const ticket = await prisma.ticket.findUnique({ where: { qrToken: code }, select: scanTicketSelect })
  const reason = ticket ? rejectReasonFor(ticket, eventId) : 'INVALID'

  // The scan record, without its result yet (filled in below)
  const record = {
    clientScanId,
    eventId,
    ticketId: ticket?.id ?? null,
    scannedCode: code,
    staffId,
    deviceId: device.id,
    method: 'QR' as const,
    scannedAt: now,
    recordedOffline: false,
  }

  try {
    // 5a. Rejected: just save the record
    if (reason || !ticket) {
      const finalReason = reason ?? 'INVALID'
      await prisma.scanRecord.create({ data: { ...record, result: 'REJECTED', rejectReason: finalReason } })
      return rejected(finalReason, ticket)
    }

    // 5b. Looks valid: admit it EXACTLY ONCE, even if two gates scan the same QR at the same moment.
    // The update only changes the ticket if it is still VALID. The database runs the two updates one
    // after the other, so the second one finds status USED and changes nothing (count 0).
    // The ticket update and the scan record are saved together, or not at all.
    const admitted = await prisma.$transaction(async (tx) => {
      await guardTx(tx)
      const { count } = await tx.ticket.updateMany({
        where: { id: ticket.id, status: 'VALID' },
        data: { status: 'USED', usedAt: now },
      })
      const won = count === 1
      await tx.scanRecord.create({
        data: { ...record, result: won ? 'ACCEPTED' : 'REJECTED', rejectReason: won ? null : 'ALREADY_USED' },
      })
      return won
    })

    if (admitted) return accepted(ticket)

    // Another gate admitted it a moment before us; read the time it was used
    const used = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: scanTicketSelect })
    return rejected('ALREADY_USED', used)
  } catch (error) {
    // Two copies of the same scan arrived at the same time and the other copy was saved first.
    // Our transaction was rolled back, so nothing changed twice; answer with the saved result.
    if (isDuplicateScanId(error)) return replayScan(clientScanId, staffId)
    throw error
  }
}