import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai'
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

// A user is waiting while these run, so each model gets a short time and no retries: if it does
// not answer, the next model is tried at once. Google refuses any request given less than 10 s
// ("Minimum allowed deadline is 10s"), so every attempt gets at least that.
const GOOGLE_MIN_DEADLINE_MS = 10_000
const CHAT_ATTEMPT_MS = 12_000
const QUERY_EMBED_MS = GOOGLE_MIN_DEADLINE_MS
const attemptTimeout = (remaining: number) => Math.max(GOOGLE_MIN_DEADLINE_MS, Math.min(CHAT_ATTEMPT_MS, remaining))
// A model that failed is skipped for a while, so the next questions go straight to one that works
// instead of each waiting for the busy model first. Each failure in a row doubles the pause
// (1, 2, 4, 8, then 15 minutes), so a model that is down for hours costs one slow reply every
// 15 minutes, while one that was briefly busy is tried again after a minute.
const SKIP_FIRST_MS = 60_000
const SKIP_MAX_MS = 15 * 60_000
const skipFor = (failuresInARow: number) => Math.min(SKIP_MAX_MS, SKIP_FIRST_MS * 2 ** (failuresInARow - 1))
// Function-calling rounds per question: e.g. search events, then look at one in detail. The last
// round offers no functions, so the model must answer with what it has.
const MAX_TOOL_ROUNDS = 3

/**
 * Whether another model may succeed where this one failed. True for "this model can't serve you
 * now": rate limit or free-tier quota (429), timeout (408/504), server errors (5xx), and network
 * failures or our own timeout (not an ApiError). False for a request Google rejects as wrong (400,
 * 403…): the same request would fail on every model.
 */
const isRetryable = (error: unknown) => !(error instanceof ApiError) || error.status === 408 || error.status === 429 || error.status >= 500

/** A short reason for the log, e.g. "429 quota or rate limit" or "no reply within 10 s" */
const describe = (error: unknown, timeoutMs: number): string => {
  if (error instanceof ApiError) {
    const kind =
      error.status === 429 ? 'quota or rate limit' : error.status === 503 ? 'overloaded' : error.status === 504 ? 'deadline exceeded' : 'error'
    return `${error.status} ${kind}`
  }
  const message = error instanceof Error ? error.message : String(error)
  return /abort|timeout|timed out/i.test(message) ? `no reply within ${Math.round(timeoutMs / 1000)} s` : message.slice(0, 120)
}

/** The LLM port implemented with Google's official SDK (@google/genai). */
export class GeminiAdapter implements LlmPort {
  readonly name: string
  private readonly ai: GoogleGenAI
  private readonly chatModels: string[]
  /** model name → time until which it is skipped */
  private readonly skipUntil = new Map<string, number>()
  /** model name → failures since its last success */
  private readonly failures = new Map<string, number>()

  constructor(private readonly options: GeminiOptions) {
    this.chatModels = [...new Set([options.chatModel, ...options.fallbackChatModels])]
    this.name = `gemini (chat: ${this.chatModels.join(' → ')}; embeddings: ${options.embeddingModel})`
    this.ai = new GoogleGenAI({
      apiKey: options.apiKey,
      // Defaults for work nobody waits on (indexing the knowledge base): a generous 60 s, because
      // 20 s was too short for the free tier on a slow line, and one retry of a busy response.
      // Chat calls override both with short limits (see generate() and embedQuery()).
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
    const [vector] = await this.embed([{ parts: [{ text: queryText(query) }] }], 1, {
      timeout: QUERY_EMBED_MS,
      retryOptions: { attempts: 1 },
    })
    return vector
  }

  async generate(request: GenerateRequest): Promise<string> {
    let lastError: unknown = new Error('No chat model could be tried before the deadline')
    for (const model of this.modelOrder()) {
      // Too little time left to try another model fairly: stop rather than blame it for being slow
      if (this.remaining(request.deadline) < GOOGLE_MIN_DEADLINE_MS) break
      try {
        const text = await this.generateWith(model, request)
        this.skipUntil.delete(model)
        this.failures.delete(model)
        if (model !== this.chatModels[0]) console.warn(`[intelligence] ${model} answered instead of ${this.chatModels[0]}`)
        return text
      } catch (error) {
        if (!isRetryable(error)) throw error
        lastError = error
        const failures = (this.failures.get(model) ?? 0) + 1
        this.failures.set(model, failures)
        this.skipUntil.set(model, Date.now() + skipFor(failures))
        console.warn(
          `[intelligence] ${model} skipped for ${Math.round(skipFor(failures) / 60_000)} min: ${describe(error, CHAT_ATTEMPT_MS)}`,
        )
      }
    }
    throw lastError
  }

  /**
   * One model's answer, running its function calls on the way: the model asks for a function,
   * we run it and send the result back, until it answers in text. The model's own turns are sent
   * back unchanged because Gemini 3 needs the thought signatures they carry.
   */
  private async generateWith(
    model: string,
    { system, turns, maxOutputTokens = 1024, deadline, tools, runTool }: GenerateRequest,
  ): Promise<string> {
    const contents: Content[] = turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }))
    const declarations = tools?.length && runTool ? tools : undefined

    for (let round = 1; ; round++) {
      // A later function-calling round still gets Google's minimum, even past the deadline, so a
      // reply that is almost done is finished instead of thrown away
      const timeout = attemptTimeout(this.remaining(deadline))
      const offerTools = declarations && round < MAX_TOOL_ROUNDS
      const response = await this.ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          maxOutputTokens,
          // Gemini 3 models reason before answering. Low keeps replies quick for a chat window
          // while leaving enough reasoning to pick the right function.
          ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          ...(offerTools
            ? {
                tools: [
                  {
                    functionDeclarations: declarations.map((t) => ({
                      name: t.name,
                      description: t.description,
                      parametersJsonSchema: t.parameters,
                    })),
                  },
                ],
              }
            : {}),
          httpOptions: { timeout, retryOptions: { attempts: 1 } },
        },
      })

      const calls = offerTools ? (response.functionCalls ?? []) : []
      if (!calls.length) {
        const text = response.text?.trim()
        if (!text) throw new Error(`${model} returned an empty reply`)
        return text
      }

      const modelTurn = response.candidates?.[0]?.content
      contents.push(modelTurn ?? { role: 'model', parts: calls.map((call) => ({ functionCall: call })) })
      const results: Part[] = await Promise.all(
        calls.map(async (call) => {
          const name = call.name ?? ''
          // A failing function is reported to the model, which can then say so, rather than failing the reply
          const result = await runTool!({ name, args: call.args ?? {} }).catch((error: unknown) => ({
            error: error instanceof Error ? error.message : String(error),
          }))
          return { functionResponse: { id: call.id, name, response: result } }
        }),
      )
      contents.push({ role: 'user', parts: results })
    }
  }

  private remaining(deadline?: number) {
    return deadline === undefined ? CHAT_ATTEMPT_MS : deadline - Date.now()
  }

  /**
   * Models that are not being skipped, in preference order. If every model failed recently,
   * the one whose pause ends first is tried anyway rather than refusing to answer at all.
   */
  private modelOrder(): string[] {
    const now = Date.now()
    const available = this.chatModels.filter((m) => (this.skipUntil.get(m) ?? 0) <= now)
    if (available.length) return available
    const soonest = [...this.chatModels].sort((a, b) => (this.skipUntil.get(a) ?? 0) - (this.skipUntil.get(b) ?? 0))[0]
    return [soonest]
  }

  private async embed(
    contents: { parts: { text: string }[] }[],
    expected: number,
    httpOptions?: { timeout: number; retryOptions: { attempts: number } },
  ): Promise<number[][]> {
    // No fallback model here on purpose: vectors from different embedding models can't be
    // compared, so a question embedded by another model would match the wrong texts.
    const response = await this.ai.models.embedContent({
      model: this.options.embeddingModel,
      contents,
      // Smaller than the default 3072: plenty for short event texts, a quarter of the storage,
      // and gemini-embedding-2 normalises shortened vectors itself.
      config: { outputDimensionality: EMBEDDING_DIMENSIONS, ...(httpOptions ? { httpOptions } : {}) },
    })
    const vectors = (response.embeddings ?? []).map((embedding) => embedding.values ?? [])
    if (vectors.length !== expected || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error(`Gemini returned ${vectors.length} embeddings for ${expected} texts, or the wrong size`)
    }
    return vectors
  }
}
