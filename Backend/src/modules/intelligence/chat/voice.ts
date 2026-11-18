/**
 * Voice chat: a WebSocket at /api/assistant/voice relays audio between the browser and Gemini Live.
 * The API key, the instructions and the functions stay on the server, as for typed chat.
 *
 * Signing in: the website first asks POST /api/assistant/voice-ticket (an ordinary API call that
 * carries the login cookie) for a one-time ticket valid for a minute, then opens the WebSocket with
 * it. The socket itself needs no cookie, so voice also works when the website and the backend are
 * on different domains (for example the website on Vercel, which cannot forward WebSockets).
 *
 * Messages, browser → server: binary frames of microphone audio (16-bit PCM, mono, 16 kHz);
 *   JSON { type: 'start', history: [{ role, text }] } once, first; JSON { type: 'stop' }.
 * Server → browser: binary frames of the assistant's speech (16-bit PCM, mono, 24 kHz); JSON
 *   { type: 'ready' }, { type: 'user_text', text } and { type: 'assistant_text', text } (the
 *   transcript so far in this exchange), { type: 'interrupted' }, { type: 'turn', user, assistant,
 *   links } when an exchange ends, { type: 'ended', reason }, { type: 'error', message }.
 */
import crypto from 'crypto'
import type { IncomingMessage, Server } from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { env } from '../../../config/env'
import { AssistantUnavailableError, getLlm, isLlmConfigured, type ToolDeclaration, type ToolRunner, type VoiceSession } from '../llm'
import { searchKnowledge, type KnowledgeHit } from '../knowledge/search'
import { ARABIC, linksFor, topicOf } from './chat.service'
import { eventFacts } from './event-facts'
import { recordMood, type Mood } from './mood'
import { voicePrompt, type Asker } from './prompt'
import { chatToolsFor, newToolContext, runChatTool } from './tools'

export const VOICE_PATH = '/api/assistant/voice'
const TICKET_TTL_MS = 60_000
// Voice uses far more free-tier quota than text, so conversations are capped
const MAX_SESSION_MS = 10 * 60_000
// Ends a conversation nobody is talking in (the microphone keeps sending silence)
const IDLE_MS = 2 * 60_000
const START_TIMEOUT_MS = 10_000
// Free tier: keep the number of simultaneous voice conversations small
const MAX_SESSIONS = 5
const MAX_SESSIONS_PER_IP = 1
// One microphone frame is a few kilobytes; anything much larger is not audio from our website
const MAX_FRAME_BYTES = 64 * 1024

// ─── Tickets ────────────────────────────────────────────────────────────────

type Ticket = { asker: Asker; userId?: string; expires: number }
const tickets = new Map<string, Ticket>()

/** POST /api/assistant/voice-ticket: a one-time pass to open the voice WebSocket within a minute */
export const issueVoiceTicket = (user?: { id: string; role: string }) => {
  if (!isLlmConfigured()) throw new AssistantUnavailableError()
  const now = Date.now()
  for (const [id, t] of tickets) if (t.expires <= now) tickets.delete(id)
  const asker: Asker = !user ? 'visitor' : user.role === 'USER' ? 'customer' : 'admin'
  const ticket = crypto.randomBytes(24).toString('base64url')
  tickets.set(ticket, { asker, userId: asker === 'customer' ? user!.id : undefined, expires: now + TICKET_TTL_MS })
  return { ticket, expiresInSeconds: TICKET_TTL_MS / 1000, maxMinutes: MAX_SESSION_MS / 60_000 }
}

const takeTicket = (id: string | null): Ticket | undefined => {
  if (!id) return undefined
  const t = tickets.get(id)
  tickets.delete(id)
  return t && t.expires > Date.now() ? t : undefined
}

// ─── Voice-only functions ───────────────────────────────────────────────────

const searchInfoTool: ToolDeclaration = {
  name: 'search_hafletna_info',
  description:
    "Searches Hafletna's knowledge: its rules (refunds, transfers, fees, entry, buying tickets, accounts) and event " +
    'descriptions, policies and FAQs, and returns live details (dates, doors, ticket types, prices, places left) of the ' +
    'events it finds. Call it before answering any question about how Hafletna works or about a specific event.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: "The user's question, in English, with the event name if they gave one" } },
    required: ['query'],
  },
}

const recordMoodTool: ToolDeclaration = {
  name: 'record_mood',
  description: 'Records how the user sounds in what they just said. Call it once after each thing the user says. Never mention it.',
  parameters: {
    type: 'object',
    properties: { mood: { type: 'string', enum: ['calm', 'confused', 'frustrated'] } },
    required: ['mood'],
  },
}

// ─── One conversation ───────────────────────────────────────────────────────

const send = (ws: WebSocket, message: Record<string, unknown>) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
}

type HistoryItem = { role: 'user' | 'assistant'; text: string }
const historyOf = (value: unknown): HistoryItem[] =>
  (Array.isArray(value) ? value : [])
    .filter((m): m is HistoryItem => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim() !== '')
    .slice(-9)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, 4000) }))

let activeSessions = 0
const sessionsByIp = new Map<string, number>()

const runConversation = (ws: WebSocket, ticket: Ticket, ip: string, history: HistoryItem[]) => {
  const { asker, userId } = ticket
  const context = newToolContext()
  // What this exchange is made of, reset when it ends
  let userText = ''
  let assistantText = ''
  let hits: KnowledgeHit[] = []
  let mood: Mood | undefined
  let voice: VoiceSession | undefined
  let lastActivity = Date.now()
  let finished = false

  const timers = [
    setTimeout(() => finish('time_limit'), MAX_SESSION_MS),
    setInterval(() => Date.now() - lastActivity > IDLE_MS && finish('idle'), 15_000),
  ]

  function finish(reason: string) {
    if (finished) return
    finished = true
    for (const t of timers) clearTimeout(t)
    voice?.close()
    send(ws, { type: 'ended', reason })
    ws.close(1000, reason)
  }

  const chatTool = runChatTool(context, userId, asker === 'admin')
  const runTool: ToolRunner = async (call) => {
    lastActivity = Date.now()
    if (call.name === 'record_mood') {
      const m = call.args.mood
      if (m === 'calm' || m === 'confused' || m === 'frustrated') mood = m
      return { ok: true }
    }
    if (call.name === 'search_hafletna_info') {
      context.used.add(call.name)
      const query = typeof call.args.query === 'string' ? call.args.query.trim().slice(0, 300) : ''
      if (!query) return { error: 'Give the question to search for' }
      hits = await searchKnowledge(query)
      const eventIds = [...new Set(hits.map((h) => h.eventId).filter((id): id is string => id !== null))].slice(0, 3)
      const facts = await eventFacts(eventIds)
      for (const f of facts) context.events.set(f.id, f.name)
      return {
        knowledge: hits.map((h) => ({ kind: h.sourceType === 'PLATFORM' ? 'Hafletna rule' : 'event information', title: h.title, text: h.content })),
        live_event_details: facts.map((f) => f.text),
      }
    }
    return chatTool(call)
  }

  const endExchange = () => {
    const user = userText.trim()
    const assistant = assistantText.trim()
    if (assistant) {
      const links = linksFor(assistant, hits, context, asker)
      send(ws, { type: 'turn', user, assistant, links })
      // Customer mood statistics, as for typed chat: no text, no user id, never administrators
      if (asker !== 'admin' && user) {
        const eventLink = links.find((l) => l.to.startsWith('/events/'))
        recordMood({
          mood,
          asker,
          arabic: ARABIC.test(user),
          topic: topicOf(hits, context, !!eventLink),
          eventId: eventLink?.to.slice('/events/'.length),
        })
      }
      userText = ''
      assistantText = ''
      hits = []
      mood = undefined
      context.used.clear()
    }
  }

  ws.on('message', (data: RawData, isBinary: boolean) => {
    if (finished) return
    if (isBinary) {
      const pcm = Buffer.isBuffer(data) ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data as ArrayBuffer)])
      voice?.sendAudio(pcm)
      return
    }
    try {
      if (JSON.parse(String(data))?.type === 'stop') finish('stopped')
    } catch {
      // not JSON: ignore
    }
  })
  ws.on('close', () => {
    finish('closed')
    activeSessions--
    const left = (sessionsByIp.get(ip) ?? 1) - 1
    if (left > 0) sessionsByIp.set(ip, left)
    else sessionsByIp.delete(ip)
  })

  getLlm()
    .openVoice({
      system: voicePrompt({ asker, now: new Date(), history }),
      tools: [searchInfoTool, ...chatToolsFor(asker), recordMoodTool],
      runTool,
      silentTools: ['record_mood'],
      events: {
        onAudio: (pcm) => {
          if (ws.readyState === ws.OPEN) ws.send(pcm, { binary: true })
        },
        onUserText: (text) => {
          lastActivity = Date.now()
          // A new question after a finished reply starts a new exchange
          userText += text
          send(ws, { type: 'user_text', text: userText.trim() })
        },
        onAssistantText: (text) => {
          assistantText += text
          send(ws, { type: 'assistant_text', text: assistantText.trim() })
        },
        onInterrupted: () => send(ws, { type: 'interrupted' }),
        onTurnComplete: () => {
          lastActivity = Date.now()
          endExchange()
        },
        onClose: (reason) => {
          console.warn(`[intelligence] voice conversation ended: ${reason}`)
          finish('unavailable')
        },
      },
    })
    .then((session) => {
      if (finished) {
        session.close()
        return
      }
      voice = session
      send(ws, { type: 'ready', maxMinutes: MAX_SESSION_MS / 60_000 })
    })
    .catch((error: unknown) => {
      console.error('[intelligence] could not start a voice conversation:', error instanceof Error ? error.message : error)
      send(ws, { type: 'error', message: 'Voice chat is not available right now. Please type your question instead.' })
      finish('unavailable')
    })
}

// ─── The WebSocket endpoint ─────────────────────────────────────────────────

const refuse = (socket: Duplex, status: string) => {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`)
  socket.destroy()
}

const clientIp = (req: IncomingMessage) =>
  (String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress) ?? 'unknown'

/** Adds the voice WebSocket to the HTTP server (call once, with the server app.listen returns) */
export const attachVoice = (server: Server) => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== VOICE_PATH) return refuse(socket, '404 Not Found')
    // Only our own website may open it (blocks other sites from using a visitor's browser)
    if (req.headers.origin !== new URL(env.FRONTEND_URL).origin) return refuse(socket, '403 Forbidden')
    const ticket = takeTicket(url.searchParams.get('ticket'))
    if (!ticket) return refuse(socket, '401 Unauthorized')
    const ip = clientIp(req)
    if (activeSessions >= MAX_SESSIONS || (sessionsByIp.get(ip) ?? 0) >= MAX_SESSIONS_PER_IP) return refuse(socket, '429 Too Many Requests')

    activeSessions++
    sessionsByIp.set(ip, (sessionsByIp.get(ip) ?? 0) + 1)
    wss.handleUpgrade(req, socket, head, (ws) => {
      // The website sends { type: 'start', history } first, so the voice continues the typed chat
      const waiting = setTimeout(() => ws.close(1008, 'no start message'), START_TIMEOUT_MS)
      let started = false
      ws.on('close', () => {
        if (!started) {
          clearTimeout(waiting)
          activeSessions--
          const left = (sessionsByIp.get(ip) ?? 1) - 1
          if (left > 0) sessionsByIp.set(ip, left)
          else sessionsByIp.delete(ip)
        }
      })
      ws.once('message', (data: RawData, isBinary: boolean) => {
        if (isBinary) return ws.close(1008, 'start first')
        let start: { type?: string; history?: unknown } = {}
        try {
          start = JSON.parse(String(data))
        } catch {
          // handled below
        }
        if (start.type !== 'start') return ws.close(1008, 'start first')
        clearTimeout(waiting)
        // from here runConversation's own close handler releases the session counts
        started = true
        runConversation(ws, ticket, ip, historyOf(start.history))
      })
    })
  })
}
