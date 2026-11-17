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

type Authentication = { user: AuthUser } | { status: 401 | 403; message: string }

/**
 * Checks a token the way every protected route does: signature and expiry first (no network), then
 * Redis "was this token logged out?" and the database "does the account still exist / is it
 * blocked?" at the same time: one round trip instead of two.
 */
const authenticate = async (token: string): Promise<Authentication> => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    const [isBlacklisted, account] = await Promise.all([
      redis.get(`blacklist:${token}`),
      // The account may have been deleted (anonymised) after this token was made
      prisma.user.findUnique({ where: { id: decoded.id }, select: { email: true, role: true, isBlocked: true } }),
    ])
    if (isBlacklisted) return { status: 401, message: 'Token is no longer valid. Please login again.' }
    if (!account || account.email.endsWith(DELETED_EMAIL_DOMAIN)) return { status: 401, message: 'This account no longer exists.' }
    // An administrator can block an account at any time: that applies at once, not at the next login
    if (account.isBlocked) return { status: 403, message: 'This account has been blocked. Please contact support.' }
    // The role is read from the database so an admin promotion or demotion applies at once
    return { user: { ...decoded, role: account.role } }
  } catch {
    return { status: 401, message: 'Invalid or expired token.' }
  }
}

const tokenOf = (req: Request): string | undefined => req.cookies?.token || req.headers.authorization?.split(' ')[1]

/**
 * Middleware to protect routes — user must be logged in
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = tokenOf(req)
  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' })
    return
  }
  const result = await authenticate(token)
  if ('status' in result) {
    res.status(result.status).json({ message: result.message })
    return
  }
  req.user = result.user
  next()
}

/**
 * For routes open to everyone that do more for signed-in users (e.g. the chatbot answering
 * "where are my tickets?"): sets req.user when a valid token is sent, and otherwise simply
 * continues as a visitor, never rejecting the request.
 */
export const identifyUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = tokenOf(req)
  if (token) {
    const result = await authenticate(token)
    if ('user' in result) req.user = result.user
  }
  next()
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