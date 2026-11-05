import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import redis from '../config/redis'
import { env } from '../config/env'
import prisma from '../config/db'
import { DELETED_EMAIL_DOMAIN } from '../modules/auth/account-deletion.worker'

const JWT_SECRET = env.JWT_SECRET

// Extend Express User type to include id and role
export interface AuthUser {
  id: string
  role: string
}

declare global {
  namespace Express {
    interface User {
      id: string
      role: string
    }
  }
}

/**
 * Middleware to protect routes — user must be logged in
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from headers
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]

    if (!token) {
      res.status(401).json({ message: 'Access denied. No token provided.' })
      return
    }

    // Verify the token first (no network), then ask Redis "was this token logged out?" and the database
    // "does the account still exist / is it blocked?" at the same time: one round trip instead of two
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    const [isBlacklisted, account] = await Promise.all([
      redis.get(`blacklist:${token}`),
      // The account may have been deleted (anonymised) after this token was made
      prisma.user.findUnique({ where: { id: decoded.id }, select: { email: true, role: true, isBlocked: true } }),
    ])
    if (isBlacklisted) {
      res.status(401).json({ message: 'Token is no longer valid. Please login again.' })
      return
    }

    if (!account || account.email.endsWith(DELETED_EMAIL_DOMAIN)) {
      res.status(401).json({ message: 'This account no longer exists.' })
      return
    }
    // An administrator can block an account at any time: that applies at once, not at the next login
    if (account.isBlocked) {
      res.status(403).json({ message: 'This account has been blocked. Please contact support.' })
      return
    }

    // The role is read from the database so an admin promotion or demotion applies at once
    req.user = { ...decoded, role: account.role }

    // Continue to the next function
    next()

  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

/**
 * Middleware to restrict routes to specific roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes((req.user as any).role)) {
      res.status(403).json({ message: 'You do not have permission to perform this action.' })
      return
    }
    next()
  }
}