/**
 * The LLM port: everything the chatbot needs from an AI provider, with no provider names in it.
 * Gemini is the adapter today (gemini.adapter.ts). Switching to another provider means writing
 * one new adapter that implements this interface; nothing else in the module changes.
 */

/** A piece of text to store in the knowledge base. */
export type KnowledgeText = { title: string; text: string }

/** One message in a conversation. 'model' is the assistant. */
export type ChatTurn = { role: 'user' | 'model'; text: string }

/** A function the model may ask us to run, described with a JSON Schema for its arguments. */
export type ToolDeclaration = {
  name: string
  /** When and why to use it: the model decides from this text */
  description: string
  /** JSON Schema of the arguments object */
  parameters: Record<string, unknown>
}

/** The model asking for one of the declared functions to run */
export type ToolCall = { name: string; args: Record<string, unknown> }

/** Runs a function call and returns its result for the model to read. Throwing is allowed. */
export type ToolRunner = (call: ToolCall) => Promise<Record<string, unknown>>

export type GenerateRequest = {
  /** Standing instructions: who the assistant is, what it may and may not do. */
  system: string
  /** The conversation so far, oldest first, ending with the user's latest message. */
  turns: ChatTurn[]
  /** Upper bound on the reply length, in tokens. */
  maxOutputTokens?: number
  /**
   * Time (Date.now() milliseconds) by which a reply must have arrived. The adapter stops trying
   * further models after it, so a chat request never outlives the website's own timeout.
   */
  deadline?: number
  /** Functions the model may call before answering, e.g. to search events in the database */
  tools?: ToolDeclaration[]
  /** Runs the model's function calls. Required when tools are given. */
  runTool?: ToolRunner
}

export interface LlmPort {
  /** Provider and model names, for logs and the health check. */
  readonly name: string

  /** Turns knowledge-base texts into vectors, one per text, in the same order. */
  embedDocuments(texts: KnowledgeText[]): Promise<number[][]>

  /** Turns a user's question into a vector comparable with embedDocuments' vectors. Fails fast: it runs while a user waits. */
  embedQuery(query: string): Promise<number[]>

  /** Writes the assistant's next reply, running any function calls it makes on the way. */
  generate(request: GenerateRequest): Promise<string>
}
