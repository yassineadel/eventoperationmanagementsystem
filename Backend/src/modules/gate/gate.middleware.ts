import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { StaffRole } from '@prisma/client'
import prisma from '../../config/db'
import { env } from '../../config/env'

// After protectGate, req.gate says which staff member is calling
declare global {
  namespace Express {
    interface Request {
      gate?: { staffId: string; role: StaffRole }
    }
  }
}

/**
 * Lets a request through only with a valid staff token from POST /api/gate/login.
 * The app sends it as:  Authorization: Bearer <token>
 */
export const protectGate = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Read the token from the header
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ message: 'Please log in' })
    return
  }

  // 2. Check the signature and expiry
  let payload: { typ?: string; staffId?: string }
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { typ?: string; staffId?: string }
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please log in again.' })
    return
  }

  // 3. Must be a staff token, not a website-user token
  if (payload.typ !== 'gate' || !payload.staffId) {
    res.status(401).json({ message: 'Please log in with a staff account' })
    return
  }

  // 4. The staff member must still exist and not be blocked (blocking works at once, FR-APP-07)
  const staff = await prisma.staffAccount.findUnique({
    where: { id: payload.staffId },
    select: { id: true, role: true, isBlocked: true },
  })
  if (!staff) {
    res.status(401).json({ message: 'Please log in with a staff account' })
    return
  }
  if (staff.isBlocked) {
    res.status(403).json({ message: 'This staff account is blocked' })
    return
  }

  req.gate = { staffId: staff.id, role: staff.role }
  next()
}

/**
 * Only for app admins (use after protectGate)
 */
export const gateAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.gate?.role !== 'APP_ADMIN') {
    res.status(403).json({ message: 'Only app admins can do this' })
    return
  }
  next()
}