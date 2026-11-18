import type { ChatMessage, ChatReply, ChatSend, ChatTurn } from './types.ts'

export const chatInputLimit = 600
// Earlier messages sent with each question so follow-ups ("how much is it?") make sense
const historyLimit = 9
export type ChatSnapshot = { messages: readonly ChatMessage[]; status: 'idle' | 'typing' | 'error'; error: 'timeout' | 'unavailable' | null }
const initialSnapshot: ChatSnapshot = { messages: [], status: 'idle', error: null }
// Website pages, plus the admin console pages the assistant links for administrators (only an
// administrator can open those; the backend only sends them in replies to administrators)
const safeDestination = /^\/(?:events(?:\/[a-z0-9-]+(?:\/tickets)?)?|my-tickets|cart|checkout|login|register|profile(?:\/settings)?|admin(?:\/(?:(?:events|orders|users)\/[a-z0-9-]+|events|orders|tickets|refunds|users|venues|staff|activity))?)(?:\?[^#\\\r\n]*)?(?:#[a-z0-9-]+)?$/

function checkedReply(reply: ChatReply): ChatReply {
  if (!reply || typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 8000) throw new Error('Invalid chat response')
  const links = Array.isArray(reply.links) ? reply.links.filter((link) => link && typeof link.label === 'string' && link.label.trim() && link.label.length <= 120 && typeof link.to === 'string' && safeDestination.test(link.to)).slice(0, 3) : []
  return { text: reply.text.trim(), ...(links.length ? { links } : {}) }
}

// Session memory only. No account, booking, browser storage, or route data is read here; the
// server recognises a signed-in user from the login cookie.
export function createChatSession(send: ChatSend, timeoutMs = 12000) {
  let snapshot = initialSnapshot
  let sequence = 0
  let messageId = 0
  let controller: AbortController | null = null
  let cancelWait: (() => void) | null = null
  let lastRequest: string | null = null
  const listeners = new Set<() => void>()
  const publish = (next: ChatSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()) }

  // The conversation before the question being asked: the question is the last message (a retry
  // re-asks it without adding it again), so everything before it is history
  function historyBefore(): ChatTurn[] {
    return snapshot.messages.slice(0, -1).slice(-historyLimit).map(({ role, text }) => ({ role, text }))
  }

  async function run(query: string) {
    const requestId = ++sequence
    const history = historyBefore()
    const requestController = new AbortController()
    controller = requestController
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    publish({ ...snapshot, status: 'typing', error: null })
    try {
      const cancellation = new Promise<never>((_resolve, reject) => {
        cancelWait = () => reject(new Error('Cancelled'))
        timer = setTimeout(() => { timedOut = true; requestController.abort(); reject(new Error('Timed out')) }, timeoutMs)
      })
      const reply = checkedReply(await Promise.race([send(query, requestController.signal, history), cancellation]))
      if (requestId !== sequence) return
      lastRequest = null
      publish({ messages: [...snapshot.messages, { ...reply, id: ++messageId, role: 'assistant' }], status: 'idle', error: null })
    } catch {
      if (requestId === sequence) publish({ ...snapshot, status: 'error', error: timedOut ? 'timeout' : 'unavailable' })
    } finally {
      clearTimeout(timer)
      if (requestId === sequence) { controller = null; cancelWait = null }
    }
  }

  function cancel() {
    ++sequence
    controller?.abort()
    cancelWait?.()
    controller = null
    cancelWait = null
    if (snapshot.status === 'typing') publish({ ...snapshot, status: 'idle', error: null })
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    ask(query: string, displayText = query) {
      const message = query.trim()
      if (snapshot.status === 'typing' || !message || message.length > chatInputLimit || !displayText.trim() || displayText.length > chatInputLimit) return false
      lastRequest = message
      publish({ messages: [...snapshot.messages.slice(-38), { id: ++messageId, role: 'user', text: displayText.trim() }], status: 'idle', error: null })
      void run(message)
      return true
    },
    retry() {
      if (snapshot.status !== 'error' || !lastRequest) return false
      void run(lastRequest)
      return true
    },
    /** Adds one spoken exchange from voice chat; the reply gets the same checks as typed replies */
    addSpokenExchange(user: string, reply: ChatReply) {
      let checked: ChatReply
      try { checked = checkedReply(reply) } catch { return false }
      const spoken = user.trim().slice(0, chatInputLimit)
      const added: ChatMessage[] = [
        ...(spoken ? [{ id: ++messageId, role: 'user' as const, text: spoken }] : []),
        { ...checked, id: ++messageId, role: 'assistant' as const },
      ]
      publish({ ...snapshot, messages: [...snapshot.messages, ...added].slice(-40) })
      return true
    },
    /** The conversation so far, for voice chat to continue it */
    history(): ChatTurn[] {
      return snapshot.messages.slice(-historyLimit).map(({ role, text }) => ({ role, text }))
    },
    reset() { cancel(); lastRequest = null; publish(initialSnapshot) },
    cancel,
  }
}
