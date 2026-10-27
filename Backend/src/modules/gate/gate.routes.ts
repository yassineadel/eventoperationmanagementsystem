import { Router } from 'express'
import { loginHandler, meHandler, eventsHandler } from './gate.controller'
import { protectGate } from './gate.middleware'
import { gateLoginLimiter } from '../../middleware/rateLimit.middleware'

const router = Router()

// GET /api/gate/ping — just checks the gate module is connected
router.get('/ping', (req, res) => {
  res.json({ message: 'gate module is alive' })
})

// POST /api/gate/login — limited against password guessing
router.post('/login', gateLoginLimiter, loginHandler)

// GET /api/gate/me — the logged-in staff member (the app checks its saved token with this)
router.get('/me', protectGate, meHandler)

// GET /api/gate/events — the events this staff member can scan
router.get('/events', protectGate, eventsHandler)

export default router