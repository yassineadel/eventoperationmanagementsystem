/**
 * The LLM port: everything the chatbot needs from an AI provider, with no provider names in it.
 * Gemini is the adapter today (gemini.adapter.ts). Switching to another provider means writing
 * one new adapter that implements this interface; nothing else in the module changes.
 */

/** A piece of text to store in the knowledge base. */
export type KnowledgeText = { title: string; text: string }

/** One message in a conversation. 'model' is the assistant. */
export type ChatTurn = { role: 'user' | 'model'; text: string }

export type GenerateRequest = {
  /** Standing instructions: who the assistant is, what it may and may not do. */
  system: string
  /** The conversation so far, oldest first, ending with the user's latest message. */
  turns: ChatTurn[]
  /** Upper bound on the reply length, in tokens. */
  maxOutputTokens?: number
}

export interface LlmPort {
  /** Provider and model names, for logs and the health check. */
  readonly name: string

  /** Turns knowledge-base texts into vectors, one per text, in the same order. */
  embedDocuments(texts: KnowledgeText[]): Promise<number[][]>

  /** Turns a user's question into a vector comparable with embedDocuments' vectors. */
  embedQuery(query: string): Promise<number[]>

  /** Writes the assistant's next reply. Function calling is added in phase 3. */
  generate(request: GenerateRequest): Promise<string>
}
