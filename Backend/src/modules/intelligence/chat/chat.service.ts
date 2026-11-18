/**
 * Typed chat: the website sends the recent conversation, we find the knowledge-base text that
 * matches the question (retrieval), add the live details of the events it found, and Gemini
 * answers from both (RAG). Gemini can also call functions (tools.ts) to search and recommend
 * events, look up venues, and, for a signed-in user, read their own tickets, orders and refunds.
 *
 * The server keeps no conversation state: the website sends the last few messages each time.
 */
import { z } from 'zod'
import { getLlm, type ChatTurn } from '../llm'
import { searchKnowledge, type KnowledgeHit } from '../knowledge/search'
import { eventFacts } from './event-facts'
import { systemPrompt, type Asker } from './prompt'
import { chatToolsFor, newToolContext, runChatTool, type ToolContext } from './tools'
import { recordMood, takeMood } from './mood'

export class ChatError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export type ChatLink = { label: string; to: string }
export type ChatReply = { text: string; links?: ChatLink[] }

// The website's input limit is 600 characters; earlier assistant replies can be longer
const USER_TEXT_MAX = 600
const ASSISTANT_TEXT_MAX = 4000
// Enough turns for follow-up questions without sending the whole visit every time
const MAX_TURNS = 10
// No new model is started after this. A function-calling round already under way may run a little
// longer (Google needs at least 10 s per request), so the website waits 45 s.
const REPLY_BUDGET_MS = 30_000
// Live details are added for at most this many of the events the search found
const MAX_LIVE_EVENTS = 3
// A rule only earns a link under the reply when it matched the question closely
const PLATFORM_LINK_DISTANCE = 0.35

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(ASSISTANT_TEXT_MAX),
      }),
    )
    .min(1)
    .max(40),
})
export type ChatRequest = z.infer<typeof chatRequestSchema>

/**
 * Keeps the last MAX_TURNS messages in the shape Gemini expects: starting with the user,
 * alternating, and ending with the user's new question.
 */
const toTurns = (messages: ChatRequest['messages']): ChatTurn[] => {
  const latest = messages[messages.length - 1]
  if (latest.role !== 'user') throw new ChatError('The last message must be your question')
  if (latest.text.length > USER_TEXT_MAX) throw new ChatError(`Please keep your question under ${USER_TEXT_MAX} characters`)

  const turns: ChatTurn[] = []
  for (const m of messages.slice(-MAX_TURNS)) {
    const role = m.role === 'user' ? 'user' : 'model'
    const last = turns[turns.length - 1]
    if (!last && role === 'model') continue
    if (last?.role === role) last.text = `${last.text}\n\n${m.text}`
    else turns.push({ role, text: m.text })
  }
  return turns
}

/**
 * The text to search with. A follow-up such as "how much is it?" means nothing alone, so the
 * previous question is included: "Tell me about Amr Diab Live" + "how much is it?" finds that event.
 */
const searchTextOf = (turns: ChatTurn[]) =>
  turns
    .filter((t) => t.role === 'user')
    .slice(-2)
    .map((t) => t.text)
    .join('\n')

export const ARABIC = /[؀-ۿ]/

/** Gemini sometimes writes Markdown; the website shows plain text, so remove the symbols */
const toPlainText = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/`([^`]+)`/g, '$1')
    .trim()

// Platform rules whose answer is acted on from a page of the website
const PLATFORM_LINKS: Record<string, { to: string; en: string; ar: string }> = {
  refunds: { to: '/my-tickets', en: 'My Tickets', ar: 'تذاكري' },
  transfers: { to: '/my-tickets', en: 'My Tickets', ar: 'تذاكري' },
  'ticket-delivery': { to: '/my-tickets', en: 'My Tickets', ar: 'تذاكري' },
  entry: { to: '/my-tickets', en: 'My Tickets', ar: 'تذاكري' },
  'how-to-buy': { to: '/events', en: 'Browse events', ar: 'تصفح الفعاليات' },
  account: { to: '/register', en: 'Create an account', ar: 'إنشاء حساب' },
  'account-deletion': { to: '/profile/settings', en: 'Account settings', ar: 'إعدادات الحساب' },
}

const page = (to: string, en: string, ar: string, arabic: boolean): ChatLink => ({ to, label: arabic ? ar : en })
const ASKS_TO_SIGN_IN = /sign in|log in|signed in|logged in|سجل|تسجيل الدخول|تسجّل/i

/**
 * Links shown under the reply: pages of events the reply names, then pages that match what the
 * answer was about (the rule it came from, the user's tickets, signing in). Built here from our own
 * data, never from the model's text, so a link can only ever point to a real page of the website.
 */
export const linksFor = (reply: string, hits: KnowledgeHit[], context: ToolContext, asker: Asker): ChatLink[] => {
  const links: ChatLink[] = []
  const add = (link: ChatLink) => {
    if (!links.some((l) => l.to === link.to)) links.push(link)
  }
  const lower = reply.toLowerCase()
  const arabic = ARABIC.test(reply)

  if (asker === 'admin') {
    // Administrators get the admin console pages of what the reply names
    const { admin } = context
    for (const [id, reference] of admin.orders) if (reply.toUpperCase().includes(reference)) add({ label: `Order ${reference}`, to: `/admin/orders/${id}` })
    for (const [id, name] of [...admin.events, ...context.events]) if (lower.includes(name.toLowerCase())) add({ label: name, to: `/admin/events/${id}` })
    for (const [id, name] of admin.customers) if (lower.includes(name.toLowerCase())) add({ label: name, to: `/admin/users/${id}` })
    if (admin.usedRefunds) add(page('/admin/refunds', 'Refund requests', 'طلبات الاسترداد', arabic))
    return links.slice(0, 3)
  }

  for (const [id, name] of context.events) {
    if (lower.includes(name.toLowerCase())) add({ label: name, to: `/events/${id}` })
  }
  if (context.usedAccount) add(page('/my-tickets', 'My Tickets', 'تذاكري', arabic))
  if (asker === 'visitor' && ASKS_TO_SIGN_IN.test(reply)) add(page('/login', 'Sign in', 'تسجيل الدخول', arabic))
  // Only the closest rules: a rule further down the list was not what the answer was about
  for (const h of hits.slice(0, 2)) {
    const rule = h.sourceType === 'PLATFORM' && h.distance <= PLATFORM_LINK_DISTANCE ? PLATFORM_LINKS[h.sourceId] : undefined
    if (rule) add(page(rule.to, rule.en, rule.ar, arabic))
  }
  return links.slice(0, 3)
}

/**
 * What a question was about, for the mood statistics: the Hafletna rule it matched closely, the
 * kind of function the model needed, or the event the reply named.
 */
export const topicOf = (hits: KnowledgeHit[], context: ToolContext, eventLinked: boolean): string => {
  const top = hits[0]
  if (top?.sourceType === 'PLATFORM' && top.distance <= PLATFORM_LINK_DISTANCE) return top.sourceId
  if (['get_my_tickets', 'get_my_orders', 'get_my_refunds', 'check_refund'].some((t) => context.used.has(t))) return 'my-account'
  if (context.used.has('get_venue_details')) return 'venues'
  if (context.used.has('search_events') || context.used.has('recommend_events')) return 'finding-events'
  if (eventLinked || (top && top.sourceType !== 'PLATFORM')) return 'event'
  return 'other'
}

/**
 * Answers the latest question in the conversation.
 * `user` is the signed-in account from the login (req.user), or undefined for a visitor. Only a
 * customer account has tickets and orders, so only customers get the account functions; only
 * administrators get the (read-only) admin functions.
 */
export const reply = async (
  request: ChatRequest,
  user?: { id: string; role: string },
  /** for the terminal test chat: called with the mood the model read (never sent to the website) */
  onMood?: (mood: string) => void,
): Promise<ChatReply> => {
  const startedAt = Date.now()
  const turns = toTurns(request.messages)
  const hits = await searchKnowledge(searchTextOf(turns))

  // Events the search found, closest first, with their live details from the database
  const eventIds = [...new Set(hits.map((h) => h.eventId).filter((id): id is string => id !== null))].slice(0, MAX_LIVE_EVENTS)
  const facts = await eventFacts(eventIds)
  const context = newToolContext(new Map(facts.map((f) => [f.id, f.name])))
  const asker: Asker = !user ? 'visitor' : user.role === 'USER' ? 'customer' : 'admin'
  const userId = asker === 'customer' ? user!.id : undefined

  const text = await getLlm().generate({
    system: systemPrompt({ knowledge: hits, facts, asker, now: new Date() }),
    turns,
    // administrators ask for summaries of many rows
    maxOutputTokens: asker === 'admin' ? 1500 : 800,
    deadline: startedAt + REPLY_BUDGET_MS,
    tools: chatToolsFor(asker),
    runTool: runChatTool(context, userId, asker === 'admin'),
  })

  // The mood tag is for us: take it off before the user sees the reply
  const { text: untagged, mood } = takeMood(text)
  onMood?.(mood ?? 'unknown')
  const plain = toPlainText(untagged)
  if (!plain) throw new Error('The reply was empty once the mood tag was removed')
  const links = linksFor(plain, hits, context, asker)

  // Customer mood statistics: no message text, no user id, and never administrators' questions
  if (asker !== 'admin') {
    const eventLink = links.find((l) => l.to.startsWith('/events/'))
    recordMood({
      mood,
      asker,
      arabic: ARABIC.test(turns[turns.length - 1].text),
      topic: topicOf(hits, context, !!eventLink),
      eventId: eventLink?.to.slice('/events/'.length),
    })
  }
  return links.length ? { text: plain, links } : { text: plain }
}
