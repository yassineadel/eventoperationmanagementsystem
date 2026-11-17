import { Request, Response } from 'express'
import { ApiError } from '@google/genai'
import { AssistantUnavailableError } from '../llm'
import { ChatError, chatRequestSchema, reply } from './chat.service'

/**
 * POST /api/assistant/chat — body: { messages: [{ role: 'user' | 'assistant', text }] }, newest last.
 * Open to everyone; a signed-in customer can also ask about their own tickets, orders and refunds.
 */
export const chat = async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Send the conversation as messages: [{ role, text }], ending with your question' })
    return
  }
  try {
    // Only customers have tickets and orders; staff and administrators chat as visitors
    const userId = req.user?.role === 'USER' ? req.user.id : undefined
    res.json(await reply(parsed.data, userId))
  } catch (error) {
    if (error instanceof ChatError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    if (error instanceof AssistantUnavailableError) {
      res.status(503).json({ message: 'The assistant is not available right now.' })
      return
    }
    // Every model busy, over quota or too slow: the website shows its "try again" state
    const busy = !(error instanceof ApiError) || error.status === 429 || error.status >= 500
    console.error('[intelligence] chat failed:', error instanceof Error ? error.message : error)
    res
      .status(busy ? 503 : 500)
      .json({ message: busy ? 'The assistant is busy. Please try again in a minute.' : 'Something went wrong' })
  }
}
