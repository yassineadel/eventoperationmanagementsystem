import { Request, Response } from 'express'
import { GateError, getStaff, login } from './gate.service'

// POST /api/gate/login  body: { username, password }
export const loginHandler = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body ?? {}
    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required' })
      return
    }
    const result = await login(username, password)
    res.json(result)
  } catch (error) {
    if (error instanceof GateError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error(error)
    res.status(500).json({ message: 'Something went wrong' })
  }
}

// GET /api/gate/me  (needs protectGate): who is logged in
export const meHandler = async (req: Request, res: Response) => {
  try {
    const staff = await getStaff(req.gate!.staffId)
    res.json({ staff })
  } catch (error) {
    if (error instanceof GateError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error(error)
    res.status(500).json({ message: 'Something went wrong' })
  }
}