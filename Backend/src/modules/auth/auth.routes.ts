import { Router } from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import { setAuthCookie } from '../../utils/cookie'
import { env } from '../../config/env'
import { validate } from '../../middleware/validate.middleware'
import { authLimiter, emailLimiter } from '../../middleware/rateLimit.middleware'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schemas'
import {
  register,
  login,
  verify,
  forgotPasswordHandler,
  resetPasswordHandler,
  logout,
  me
} from './auth.controller'
import { protect } from '../../middleware/auth.middleware'

const router = Router()

router.post('/register', emailLimiter, validate(registerSchema), register)
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verify)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/forgot-password', emailLimiter, validate(forgotPasswordSchema), forgotPasswordHandler)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPasswordHandler)
router.post('/logout', logout)

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/me', protect, me)
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const user = req.user as any

    const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
      expiresIn: '7d',
    })

    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`)
  }
)

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const user = req.user as any

    const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
      expiresIn: '7d',
    })

    setAuthCookie(res, token)
    res.redirect(`${env.FRONTEND_URL}/auth/callback`)
  }
)


export default router