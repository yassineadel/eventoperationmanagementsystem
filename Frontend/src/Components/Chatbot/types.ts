export type ChatLink = { label: string; to: string }
export type ChatReply = { text: string; links?: ChatLink[] }
/** One earlier message, oldest first, so the assistant understands follow-up questions */
export type ChatTurn = { role: 'user' | 'assistant'; text: string }
export type ChatSend = (message: string, signal: AbortSignal, history: ChatTurn[]) => Promise<ChatReply>
export type ChatMessage = ChatReply & { id: number; role: 'user' | 'assistant' }
