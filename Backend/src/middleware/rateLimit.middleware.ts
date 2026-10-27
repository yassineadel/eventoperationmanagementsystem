import { rateLimit } from 'express-rate-limit'

/** For endpoints an attacker would brute-force: 10 tries per 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
})

/**
 * For the gate app login: 10 failed tries per 15 min per IP.
 * Successful logins don't count, so scanners sharing one venue IP don't lock each other out.
 */
export const gateLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
})

/**
 * For gate scans: 1000 per minute per staff member, not per IP, because many scanners
 * at one venue can share one IP. Counts by req.gate.staffId, so it must run after protectGate.
 */
export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1000,
  keyGenerator: (req) => req.gate!.staffId,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many scans. Please wait a moment and try again.' },
})

/** For endpoints that send real emails: 3 per hour per IP */
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
})

/** Everything else */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
})