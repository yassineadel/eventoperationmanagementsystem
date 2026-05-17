import { Router } from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import { register, login, verify, forgotPasswordHandler, resetPasswordHandler ,logout} from './auth.controller'

const router = Router()

// POST /api/auth/register
router.post('/register', register)

// POST /api/auth/verify-email
router.post('/verify-email', verify)

// POST /api/auth/login
router.post('/login', login)

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordHandler)

// POST /api/auth/reset-password
router.post('/reset-password', resetPasswordHandler)

// POST /api/auth/logout
router.post('/logout', logout)

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const user = req.user as any

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    )

    // Return JSON for now until frontend is ready
    res.json({ message: 'Google login successful', token, user })
  }
)


export default router