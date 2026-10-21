import { Router } from 'express'
import { loginHandler } from './gate.controller'

const router = Router()

// GET /api/gate/ping — just checks the gate module is connected
router.get('/ping', (req, res) => {
  res.json({ message: 'gate module is alive' })
})

// POST /api/gate/login
router.post('/login', loginHandler)

export default router