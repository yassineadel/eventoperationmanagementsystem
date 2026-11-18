import { Router } from 'express'
import { chat, mood } from './chat.controller'
import { assistantLimiter } from '../../../middleware/rateLimit.middleware'
import { identifyUser, protect, restrictTo } from '../../../middleware/auth.middleware'

// Mounted at /api/assistant
const router = Router()

// Public: visitors can ask without an account. identifyUser recognises a signed-in user (from the
// login cookie) without rejecting visitors, so customers can also ask about their own tickets.
router.post('/chat', assistantLimiter, identifyUser, chat)

// Administrators: how customers felt when asking the chatbot (no message text is stored)
router.get('/mood', protect, restrictTo('ADMIN'), mood)

export default router
