import { API_URL, ApiError, postJson } from '../../lib/api'
import { createSpeaker, startMicrophone, type Microphone, type Speaker } from './voiceAudio'
import type { ChatLink, ChatReply, ChatTurn } from './types'

// The backend's voice WebSocket. In production the website may be on another domain than the API
// (Vercel cannot forward WebSockets), so it can be set on its own.
const VOICE_URL = (import.meta.env?.VITE_VOICE_URL as string | undefined) ?? `${API_URL.replace(/^http/, 'ws')}/api/assistant/voice`

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking'
/** Why voice stopped, when it was not the user's choice */
export type VoiceProblem = 'microphone' | 'unavailable' | 'busy' | 'time_limit' | 'idle'

export type VoiceCallbacks = {
  onState(state: VoiceState): void
  /** What is being said right now in this exchange, as it is transcribed */
  onCaptions(captions: { user: string; assistant: string }): void
  /** One finished exchange, to add to the chat */
  onTurn(user: string, reply: ChatReply): void
  onProblem(problem: VoiceProblem): void
}

type SocketLike = {
  binaryType: string
  readyState: number
  send(data: string | ArrayBuffer): void
  close(code?: number): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

/** The browser pieces voice needs; tests pass fakes */
export type VoiceDeps = {
  getTicket(): Promise<string>
  openSocket(url: string): SocketLike
  startMicrophone(onChunk: (pcm: ArrayBuffer) => void): Promise<Microphone>
  createSpeaker(onSpeakingChange: (speaking: boolean) => void): Speaker
}

const browserDeps: VoiceDeps = {
  getTicket: async () => (await postJson<{ ticket: string }>('/api/assistant/voice-ticket', {})).ticket,
  openSocket: (url) => new WebSocket(url) as unknown as SocketLike,
  startMicrophone,
  createSpeaker,
}

const OPEN = 1

/**
 * One voice conversation at a time: start() asks for a ticket, opens the socket, sends the chat so
 * far, then streams the microphone; the assistant's speech is played as it arrives.
 */
export function createVoiceController(callbacks: VoiceCallbacks, deps: VoiceDeps = browserDeps) {
  let socket: SocketLike | null = null
  let microphone: Microphone | null = null
  let speaker: Speaker | null = null
  let state: VoiceState = 'idle'
  let run = 0
  let captions = { user: '', assistant: '' }

  const setState = (next: VoiceState) => {
    if (next !== state) { state = next; callbacks.onState(next) }
  }
  const setCaptions = (next: { user: string; assistant: string }) => {
    captions = next
    callbacks.onCaptions(next)
  }

  function cleanup() {
    run++
    microphone?.stop()
    speaker?.close()
    if (socket && socket.readyState === OPEN) socket.close(1000)
    socket = microphone = speaker = null
    setCaptions({ user: '', assistant: '' })
    setState('idle')
  }

  function fail(problem: VoiceProblem) {
    cleanup()
    callbacks.onProblem(problem)
  }

  async function onText(raw: string, current: number) {
    let message: { type?: string; text?: string; user?: string; assistant?: string; links?: ChatLink[]; reason?: string }
    try { message = JSON.parse(raw) } catch { return }
    switch (message.type) {
      case 'ready':
        try {
          const mic = await deps.startMicrophone((pcm) => { if (socket?.readyState === OPEN) socket.send(pcm) })
          if (current !== run) { mic.stop(); return }
          microphone = mic
          setState('listening')
        } catch {
          if (current === run) fail('microphone')
        }
        return
      case 'user_text':
        setCaptions({ user: message.text ?? '', assistant: captions.assistant })
        return
      case 'assistant_text':
        setCaptions({ user: captions.user, assistant: message.text ?? '' })
        return
      case 'interrupted':
        speaker?.interrupt()
        return
      case 'turn':
        if (message.assistant) callbacks.onTurn(message.user ?? '', { text: message.assistant, links: message.links })
        setCaptions({ user: '', assistant: '' })
        return
      case 'ended':
        if (message.reason === 'stopped' || message.reason === 'closed') cleanup()
        else fail(message.reason === 'time_limit' || message.reason === 'idle' ? message.reason : 'unavailable')
        return
      case 'error':
        fail('unavailable')
    }
  }

  return {
    getState: () => state,

    /** Starts talking; `history` is the chat so far, so voice continues the same conversation */
    async start(history: ChatTurn[]) {
      if (state !== 'idle') return
      const current = ++run
      setState('connecting')
      let ticket: string
      try {
        ticket = await deps.getTicket()
      } catch (error) {
        if (current === run) fail(error instanceof ApiError && error.status === 429 ? 'busy' : 'unavailable')
        return
      }
      if (current !== run) return
      speaker = deps.createSpeaker((speaking) => {
        if (current === run && state !== 'connecting') setState(speaking ? 'speaking' : 'listening')
      })
      const ws = deps.openSocket(`${VOICE_URL}?ticket=${encodeURIComponent(ticket)}`)
      socket = ws
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => ws.send(JSON.stringify({ type: 'start', history: history.slice(-9) }))
      ws.onmessage = (event) => {
        if (current !== run) return
        if (event.data instanceof ArrayBuffer) speaker?.play(event.data)
        else if (typeof event.data === 'string') void onText(event.data, current)
      }
      // Refused (busy, expired ticket) or dropped without a goodbye
      ws.onclose = () => { if (current === run) fail(state === 'connecting' ? 'busy' : 'unavailable') }
      ws.onerror = () => {}
    },

    /** Stops talking; the chat keeps everything said so far */
    stop() {
      if (socket?.readyState === OPEN) socket.send(JSON.stringify({ type: 'stop' }))
      cleanup()
    },
  }
}

export type VoiceController = ReturnType<typeof createVoiceController>
