import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import redis from '../config/redis'
import { env } from '../config/env'

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

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redis.get(`blacklist:${token}`)
    if (isBlacklisted) {
      res.status(401).json({ message: 'Token is no longer valid. Please login again.' })
      return
    }

    // Verify token and attach user to request
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    req.user = decoded

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