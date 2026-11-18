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

/** What a live voice session reports back while it runs */
export type VoiceEvents = {
  /** The assistant's speech: raw 16-bit little-endian PCM, mono, 24 kHz */
  onAudio(pcm: Buffer): void
  /** A piece of the written transcript of what the user said */
  onUserText(text: string): void
  /** A piece of the written transcript of what the assistant said */
  onAssistantText(text: string): void
  /** The user spoke over the assistant: speech still queued for playback must be dropped */
  onInterrupted(): void
  /** The assistant finished its reply to the user's last turn */
  onTurnComplete(): void
  /** The session ended for good (not a reconnection); `reason` is for logs */
  onClose(reason: string): void
}

export type VoiceSessionOptions = {
  /** Standing instructions, as for typed chat */
  system: string
  tools: ToolDeclaration[]
  runTool: ToolRunner
  /** Functions the assistant calls without waiting or speaking about the result (e.g. recording the mood) */
  silentTools?: string[]
  events: VoiceEvents
}

/** A live, two-way voice conversation */
export interface VoiceSession {
  /** The user's microphone: raw 16-bit little-endian PCM, mono, 16 kHz */
  sendAudio(pcm: Buffer): void
  /** Ends the conversation */
  close(): void
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

  /** Opens a live voice conversation: the user talks, the assistant answers out loud. */
  openVoice(options: VoiceSessionOptions): Promise<VoiceSession>
}
