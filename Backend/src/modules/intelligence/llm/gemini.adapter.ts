import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai'
import { EMBEDDING_DIMENSIONS } from '../knowledge/vector'
import type { GenerateRequest, KnowledgeText, LlmPort } from './llm.port'

type GeminiOptions = {
  apiKey: string
  chatModel: string
  /** Tried in order when the chat model is busy. Embeddings never fall back (see embed()). */
  fallbackChatModels: string[]
  embeddingModel: string
}

// gemini-embedding-2 takes the task as text in front of the input (it has no task_type field).
// Documents and questions use the formats from Google's embeddings guide, so they compare well.
const documentText = ({ title, text }: KnowledgeText) => `title: ${title.trim() || 'none'} | text: ${text.trim()}`
const queryText = (query: string) => `task: search result | query: ${query.trim()}`

// Texts sent per embedding request when indexing the knowledge base
const EMBED_BATCH_SIZE = 100

// Errors that mean "this model can't serve you right now", not "your request is wrong":
// rate limit (429), overloaded (503), server error (500) and deadline exceeded (504).
// On the free tier each model has its own quota and load, so another model often still answers.
const BUSY_STATUSES = new Set([429, 500, 503, 504])
const isBusy = (error: unknown) => error instanceof ApiError && BUSY_STATUSES.has(error.status)

/** The LLM port implemented with Google's official SDK (@google/genai). */
export class GeminiAdapter implements LlmPort {
  readonly name: string
  private readonly ai: GoogleGenAI
  private readonly chatModels: string[]

  constructor(private readonly options: GeminiOptions) {
    this.chatModels = [...new Set([options.chatModel, ...options.fallbackChatModels])]
    this.name = `gemini (chat: ${this.chatModels.join(' → ')}; embeddings: ${options.embeddingModel})`
    this.ai = new GoogleGenAI({
      apiKey: options.apiKey,
      // timeout is also sent to Google as the server-side deadline (X-Server-Timeout). 20 s was
      // too short for the free tier on a slow line (504 DEADLINE_EXCEEDED), so allow 60 s.
      // The SDK retries busy responses once with a short backoff; after that generate() moves
      // on to the next model instead of making the user wait through more retries.
      httpOptions: { timeout: 60_000, retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 4 } },
    })
  }

  async embedDocuments(texts: KnowledgeText[]): Promise<number[][]> {
    const vectors: number[][] = []
    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
      // One content object per text: several texts in a single content would be merged into
      // one embedding by gemini-embedding-2.
      vectors.push(...(await this.embed(batch.map((t) => ({ parts: [{ text: documentText(t) }] })), batch.length)))
    }
    return vectors
  }

  async embedQuery(query: string): Promise<number[]> {
    const [vector] = await this.embed([{ parts: [{ text: queryText(query) }] }], 1)
    return vector
  }

  async generate({ system, turns, maxOutputTokens = 1024 }: GenerateRequest): Promise<string> {
    let lastError: unknown
    for (const model of this.chatModels) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
          config: {
            systemInstruction: system,
            maxOutputTokens,
            // Gemini 3 models reason before answering. Low keeps replies quick for a chat window
            // while leaving enough reasoning to pick the right function in later phases.
            ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          },
        })
        const text = response.text?.trim()
        if (!text) throw new Error(`${model} returned an empty reply`)
        if (model !== this.chatModels[0]) console.warn(`[intelligence] ${this.chatModels[0]} was busy; ${model} answered`)
        return text
      } catch (error) {
        if (!isBusy(error)) throw error
        lastError = error
      }
    }
    throw lastError
  }

  private async embed(contents: { parts: { text: string }[] }[], expected: number): Promise<number[][]> {
    // No fallback model here on purpose: vectors from different embedding models can't be
    // compared, so a question embedded by another model would match the wrong texts.
    const response = await this.ai.models.embedContent({
      model: this.options.embeddingModel,
      contents,
      // Smaller than the default 3072: plenty for short event texts, a quarter of the storage,
      // and gemini-embedding-2 normalises shortened vectors itself.
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    })
    const vectors = (response.embeddings ?? []).map((embedding) => embedding.values ?? [])
    if (vectors.length !== expected || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error(`Gemini returned ${vectors.length} embeddings for ${expected} texts, or the wrong size`)
    }
    return vectors
  }
}
