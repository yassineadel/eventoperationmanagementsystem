import { postJson } from '../../lib/api'
import type { ChatReply, ChatSend } from './types'

// The backend accepts earlier messages up to this length; longer ones are shortened
const historyTextLimit = 4000

/**
 * The live assistant: POST /api/assistant/chat on the Hafletna backend.
 * Sends the question with the recent conversation. The login cookie goes with the request
 * (credentials: 'include' in postJson), so a signed-in customer can also ask about their own
 * tickets, orders and refunds; visitors get public answers only.
 */
export const assistantChatReply: ChatSend = (message, signal, history) =>
  postJson<ChatReply>(
    '/api/assistant/chat',
    {
      messages: [
        ...history.map(({ role, text }) => ({ role, text: text.slice(0, historyTextLimit) })),
        { role: 'user', text: message },
      ],
    },
    { signal },
  )
