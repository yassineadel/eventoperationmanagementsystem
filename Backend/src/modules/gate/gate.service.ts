import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../../config/db'
import { env } from '../../config/env'

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