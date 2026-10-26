import { Router } from 'express'
import { loginHandler, meHandler } from './gate.controller'
import { protectGate } from './gate.middleware'

const router = Router()

// GET /api/gate/ping — just checks the gate module is connected
router.get('/ping', (req, res) => {
  res.json({ message: 'gate module is alive' })
})

// POST /api/gate/login
router.post('/login', loginHandler)

// GET /api/gate/me — the logged-in staff member (the app checks its saved token with this)
router.get('/me', protectGate, meHandler)

export default router