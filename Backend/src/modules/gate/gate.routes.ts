import { Router } from 'express'
import { loginHandler, meHandler, eventsHandler, scanHandler } from './gate.controller'
import { protectGate } from './gate.middleware'
import { gateLoginLimiter, scanLimiter } from '../../middleware/rateLimit.middleware'

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

// POST /api/gate/scan — check a QR code at the gate and admit the ticket.
// Not under the general limit (see app.ts); scanLimiter counts per staff member, so it comes after protectGate.
router.post('/scan', protectGate, scanLimiter, scanHandler)

export default router