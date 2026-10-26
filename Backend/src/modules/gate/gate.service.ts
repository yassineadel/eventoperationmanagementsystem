import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../../config/db'
import { env } from '../../config/env'
import type { StaffRole } from '@prisma/client'

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
      ...(role === 'APP_ADMIN'
        ? {}
        : {
            staffAssignments: {
              some: {
                staffId,
                revokedAt: null,
                AND: [
                  { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
                  { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
                ],
              },
            },
          }),
    },
    select: { id: true, name: true, startAt: true, durationMinutes: true, venue: { select: { name: true, type: true } } },
    orderBy: { startAt: 'asc' },
  })

  return events
    // ends = start + duration; drop the ones already over
    .filter((e) => e.startAt.getTime() + e.durationMinutes * 60_000 >= now.getTime())
    .map((e) => ({ id: e.id, name: e.name, venueName: e.venue.name, startAt: e.startAt, seated: e.venue.type === 'SEATED' }))
}