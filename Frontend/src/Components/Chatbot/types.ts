export type ChatLink = { label: string; to: string }
export type ChatReply = { text: string; links?: ChatLink[] }
export type ChatSend = (message: string, signal: AbortSignal) => Promise<ChatReply>
export type ChatMessage = ChatReply & { id: number; role: 'user' | 'assistant' }
