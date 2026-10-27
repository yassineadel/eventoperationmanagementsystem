import { Request, Response } from 'express'
import { GateError, getStaff, login, getAssignedEvents, scanTicket } from './gate.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A non-empty string no longer than max (the database column size), so bad input gets a 400, not a 500
const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max

// POST /api/gate/login  body: { username, password }
export const loginHandler = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body ?? {}
    // Must be non-empty strings (an object here would reach the Prisma query)
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
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

// GET /api/gate/events  (needs protectGate): the events this staff member can scan
export const eventsHandler = async (req: Request, res: Response) => {
  try {
    const events = await getAssignedEvents(req.gate!.staffId, req.gate!.role)
    res.json({ events })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Something went wrong' })
  }
}

// POST /api/gate/scan  (needs protectGate)  header: X-Device-Id  body: { clientScanId, eventId, code }
export const scanHandler = async (req: Request, res: Response) => {
  try {
    const { clientScanId, eventId, code } = req.body ?? {}
    const deviceIdentifier = req.get('X-Device-Id')

    // Check the input first (sizes match the database columns)
    if (!isText(deviceIdentifier, 255)) {
      res.status(400).json({ message: 'The X-Device-Id header is required' })
      return
    }
    if (!isText(clientScanId, 100)) {
      res.status(400).json({ message: 'clientScanId must be a text of at most 100 characters' })
      return
    }
    if (typeof eventId !== 'string' || !UUID.test(eventId)) {
      res.status(400).json({ message: 'eventId must be a valid id' })
      return
    }
    if (!isText(code, 512)) {
      res.status(400).json({ message: 'code must be a text of at most 512 characters' })
      return
    }

    const result = await scanTicket({
      staffId: req.gate!.staffId,
      role: req.gate!.role,
      clientScanId,
      eventId,
      code,
      deviceIdentifier,
    })
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