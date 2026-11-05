import { env } from '../../../config/env'
import { GeminiAdapter } from './gemini.adapter'
import type { LlmPort } from './llm.port'

export type { ChatTurn, GenerateRequest, KnowledgeText, LlmPort } from './llm.port'

/** Thrown when the assistant is asked to work but no AI provider is configured. */
export class AssistantUnavailableError extends Error {
  constructor() {
    super('The assistant is not configured on this server (GEMINI_API_KEY is missing)')
    this.name = 'AssistantUnavailableError'
  }
}

// The one place that picks the provider. Everything else imports getLlm() and the port type.
const llm: LlmPort | null = env.GEMINI_API_KEY
  ? new GeminiAdapter({
      apiKey: env.GEMINI_API_KEY,
      chatModel: env.GEMINI_CHAT_MODEL,
      fallbackChatModels: env.GEMINI_CHAT_FALLBACK_MODELS,
      embeddingModel: env.GEMINI_EMBEDDING_MODEL,
    })
  : null

export const isLlmConfigured = () => llm !== null

export function getLlm(): LlmPort {
  if (!llm) throw new AssistantUnavailableError()
  return llm
}
