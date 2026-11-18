/**
 * Voice conversations with the Gemini Live API (gemini-3.8-live): the user's microphone audio is
 * streamed in, the model's speech streams out, and both sides are also transcribed as text.
 *
 * Google limits each connection to about 10 minutes and warns about a minute before closing it
 * ("goAway"). The session keeps a resumption handle that Google updates as the conversation goes,
 * so when a connection ends we open a new one with that handle and the conversation simply carries
 * on. Context window compression keeps long conversations within the model's context.
 */
import { Behavior, FunctionResponseScheduling, Modality, type GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai'
import type { VoiceSession, VoiceSessionOptions } from './llm.port'

const INPUT_MIME = 'audio/pcm;rate=16000'
// Reconnections in a row without a successful turn before giving up
const MAX_RECONNECTS = 3
// Microphone audio kept while a reconnection is under way (about 2 s at 16 kHz, 16-bit)
const MAX_QUEUED_BYTES = 64_000

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e))

export const openGeminiVoice = async (ai: GoogleGenAI, model: string, options: VoiceSessionOptions): Promise<VoiceSession> => {
  const { system, tools, runTool, events } = options
  const silent = new Set(options.silentTools ?? [])
  // Blocking: the model waits for our answer before speaking about it, so it never guesses a price
  // while the database is being read. Silent functions (the mood) run without the model waiting.
  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.parameters,
    behavior: silent.has(t.name) ? Behavior.NON_BLOCKING : Behavior.BLOCKING,
  }))

  let session: Session | undefined
  let handle: string | undefined
  let closedByUs = false
  let ended = false
  let reconnects = 0
  let connecting: Promise<void> | undefined
  const queued: Buffer[] = []
  let queuedBytes = 0

  const end = (reason: string) => {
    if (ended) return
    ended = true
    events.onClose(reason)
  }

  const onToolCall = async (s: Session, calls: NonNullable<LiveServerMessage['toolCall']>['functionCalls']) => {
    const functionResponses = await Promise.all(
      (calls ?? []).map(async (call) => {
        const name = call.name ?? ''
        const response = await runTool({ name, args: call.args ?? {} }).catch((error: unknown) => ({ error: reasonOf(error) }))
        return {
          id: call.id,
          name,
          response,
          // the mood is recorded quietly: the model should not talk about it
          ...(silent.has(name) ? { scheduling: FunctionResponseScheduling.SILENT } : {}),
        }
      }),
    )
    // The conversation may have moved to a new connection meanwhile; answer on the current one
    if (!ended) (session ?? s).sendToolResponse({ functionResponses })
  }

  const onMessage = (s: Session, message: LiveServerMessage) => {
    const content = message.serverContent
    if (content) {
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) events.onAudio(Buffer.from(part.inlineData.data, 'base64'))
      }
      if (content.inputTranscription?.text) events.onUserText(content.inputTranscription.text)
      if (content.outputTranscription?.text) events.onAssistantText(content.outputTranscription.text)
      if (content.interrupted) events.onInterrupted()
      if (content.turnComplete) {
        reconnects = 0
        events.onTurnComplete()
      }
    }
    if (message.toolCall?.functionCalls?.length) void onToolCall(s, message.toolCall.functionCalls)
    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
      handle = message.sessionResumptionUpdate.newHandle
    }
    // Google will close this connection soon: move to a new one now, with the resumption handle
    if (message.goAway) void reconnect('connection time limit')
  }

  const connect = async (): Promise<void> => {
    let opened: Session | undefined
    const next = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: system,
        tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: handle ? { handle } : {},
        contextWindowCompression: { slidingWindow: {} },
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (opened) onMessage(opened, message)
        },
        onerror: (e: unknown) => console.warn('[intelligence] voice connection error:', reasonOf((e as { message?: unknown })?.message ?? e)),
        onclose: (e: { code?: number; reason?: string }) => {
          // Only the current connection's closing matters; an old one closes after we have moved on
          if (opened !== session || closedByUs || ended) return
          void reconnect(`connection closed (${e?.code ?? '?'}${e?.reason ? `: ${e.reason}` : ''})`)
        },
      },
    })
    opened = next
    const previous = session
    session = next
    previous?.close()
    // Microphone audio that arrived while reconnecting
    for (const chunk of queued.splice(0)) next.sendRealtimeInput({ audio: { data: chunk.toString('base64'), mimeType: INPUT_MIME } })
    queuedBytes = 0
  }

  const reconnect = async (why: string) => {
    if (connecting || ended || closedByUs) return
    if (!handle || reconnects >= MAX_RECONNECTS) {
      end(why)
      return
    }
    reconnects++
    console.warn(`[intelligence] voice: ${why}; resuming the conversation on a new connection`)
    connecting = connect()
      .catch((e) => end(`could not reconnect: ${reasonOf(e)}`))
      .finally(() => (connecting = undefined))
  }

  await connect()

  return {
    sendAudio(pcm: Buffer) {
      if (ended) return
      if (connecting || !session) {
        if (queuedBytes + pcm.length <= MAX_QUEUED_BYTES) {
          queued.push(pcm)
          queuedBytes += pcm.length
        }
        return
      }
      session.sendRealtimeInput({ audio: { data: pcm.toString('base64'), mimeType: INPUT_MIME } })
    },
    close() {
      closedByUs = true
      session?.close()
      end('closed by the user')
    },
  }
}
