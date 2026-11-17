/**
 * Knowledge ingestion: turns descriptive text into searchable chunks in knowledge_chunks.
 *
 * What gets indexed (live facts such as prices, seats left and dates are NOT: the chatbot reads
 * those from the database through functions, so they are never stale):
 *   EVENT         an event's name, performer, category, venue, description and about text
 *   EVENT_FAQ     one chunk per question and answer in an event's FAQs
 *   EVENT_POLICY  an event's policies (age, entry, refunds, transfers…)
 *   PLATFORM      the platform rules in platform-rules.ts
 *
 * Only published events that have not ended are searchable. Drafts, cancelled and finished events
 * have their chunks removed, so the chatbot never recommends something you cannot buy.
 *
 * Each chunk stores a SHA-256 of its title and text. Unchanged chunks are skipped, so re-running
 * costs nothing on Gemini's free tier; only new or edited texts are embedded.
 */
import crypto from 'crypto'
import type { KnowledgeSource } from '@prisma/client'
import prisma from '../../../config/db'
import { getLlm, isLlmConfigured } from '../llm'
import { platformRules } from './platform-rules'
import { toVectorLiteral } from './vector'

/** One chunk as it should be in the table */
type ChunkInput = {
  sourceType: KnowledgeSource
  sourceId: string
  eventId: string | null
  chunkIndex: number
  title: string
  content: string
}

/** What one sync did, for logs and the ai:index script */
export type IndexResult = { embedded: number; unchanged: number; removed: number }

export type IndexOptions = {
  /** Re-embed every chunk even if its text is unchanged (needed after changing the embedding model) */
  force?: boolean
}

// Long enough to keep a paragraph's meaning together, short enough that one chunk is about one thing
const MAX_CHUNK_CHARS = 1500
// knowledge_chunks.title is VARCHAR(300)
const MAX_TITLE_CHARS = 300

const EMPTY: IndexResult = { embedded: 0, unchanged: 0, removed: 0 }
const add = (a: IndexResult, b: IndexResult): IndexResult => ({
  embedded: a.embedded + b.embedded,
  unchanged: a.unchanged + b.unchanged,
  removed: a.removed + b.removed,
})

const keyOf = (c: { sourceType: string; sourceId: string; chunkIndex: number }) => `${c.sourceType}|${c.sourceId}|${c.chunkIndex}`
const hashOf = (title: string, content: string) => crypto.createHash('sha256').update(`${title}\n${content}`).digest('hex')
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

// ─── Building chunks from text ──────────────────────────────────────────────

/**
 * Event texts are stored either as plain strings or bilingually as { en, ar }.
 * Both languages go into the chunk, so English and Arabic questions both match it.
 */
const localized = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') {
    const { en, ar } = value as { en?: unknown; ar?: unknown }
    const parts = [en, ar].filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim())
    return [...new Set(parts)].join('\n')
  }
  return ''
}

/** The English text alone, for titles (falls back to whatever text there is) */
const englishOf = (value: unknown): string => {
  if (value && typeof value === 'object' && typeof (value as { en?: unknown }).en === 'string') {
    return (value as { en: string }).en.trim()
  }
  return localized(value).split('\n')[0] ?? ''
}

/** Splits text into pieces of at most MAX_CHUNK_CHARS, breaking between paragraphs, then sentences */
export const splitText = (text: string, max = MAX_CHUNK_CHARS): string[] => {
  const pieces: string[] = []
  let current = ''
  const push = (part: string) => {
    if (!current) current = part
    else if (current.length + 2 + part.length <= max) current = `${current}\n\n${part}`
    else {
      pieces.push(current)
      current = part
    }
  }
  for (const paragraph of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    if (paragraph.length <= max) {
      push(paragraph)
      continue
    }
    // A very long paragraph: break it at sentence ends (including the Arabic question mark)
    let sentenceGroup = ''
    for (const sentence of paragraph.split(/(?<=[.!?؟])\s+/)) {
      if (sentence.length > max) {
        // No sentence breaks at all: cut hard rather than drop text
        if (sentenceGroup) push(sentenceGroup)
        sentenceGroup = ''
        for (let i = 0; i < sentence.length; i += max) push(sentence.slice(i, i + max))
      } else if (!sentenceGroup) sentenceGroup = sentence
      else if (sentenceGroup.length + 1 + sentence.length <= max) sentenceGroup = `${sentenceGroup} ${sentence}`
      else {
        push(sentenceGroup)
        sentenceGroup = sentence
      }
    }
    if (sentenceGroup) push(sentenceGroup)
  }
  if (current) pieces.push(current)
  return pieces
}

// Labels for the policy keys the admin console and seeds use; other keys are turned into words
const POLICY_LABELS: Record<string, string> = {
  ageRestrictions: 'Age restrictions',
  entryConditions: 'Entry conditions',
  entryPolicy: 'Entry policy',
  prohibitedItems: 'Prohibited items',
  refundPolicy: 'Refund policy',
  transferPolicy: 'Transfer policy',
}
const labelOf = (key: string) =>
  POLICY_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase())

type IndexableEvent = {
  id: string
  name: string
  category: string
  performer: string | null
  description: string
  about: string | null
  policies: unknown
  faqs: unknown
  venue: { name: string; city: string }
}

/** Every chunk one event should have */
export const eventChunks = (event: IndexableEvent): ChunkInput[] => {
  const chunks: ChunkInput[] = []
  const base = { sourceId: event.id, eventId: event.id }

  // EVENT: who, what and where, repeated in each piece so every piece names the event it describes
  const header = [
    `Event: ${event.name}`,
    event.performer ? `Performer: ${event.performer}` : null,
    `Category: ${event.category}`,
    `Venue: ${event.venue.name}, ${event.venue.city}`,
  ]
    .filter(Boolean)
    .join('\n')
  const body = [event.description, event.about ?? ''].map((t) => t.trim()).filter(Boolean).join('\n\n')
  const pieces = body ? splitText(body, MAX_CHUNK_CHARS - header.length - 2) : ['']
  pieces.forEach((piece, i) => {
    chunks.push({
      ...base,
      sourceType: 'EVENT',
      chunkIndex: i,
      title: clip(event.name, MAX_TITLE_CHARS),
      content: piece ? `${header}\n\n${piece}` : header,
    })
  })

  // EVENT_FAQ: one chunk per question, so a question matches its own answer and not the whole list
  const faqs = Array.isArray(event.faqs) ? event.faqs : []
  let faqIndex = 0
  for (const faq of faqs) {
    if (!faq || typeof faq !== 'object') continue
    const { question, answer } = faq as { question?: unknown; answer?: unknown }
    const q = localized(question)
    const a = localized(answer)
    if (!q || !a) continue
    chunks.push({
      ...base,
      sourceType: 'EVENT_FAQ',
      chunkIndex: faqIndex++,
      title: clip(`${event.name}: ${englishOf(question)}`, MAX_TITLE_CHARS),
      content: clip(`Event: ${event.name}\nQuestion: ${q}\nAnswer: ${a}`, MAX_CHUNK_CHARS * 2),
    })
  }

  // EVENT_POLICY: all of an event's policies together (they are short), split only if long
  const policies = event.policies && typeof event.policies === 'object' && !Array.isArray(event.policies) ? event.policies : {}
  const policyText = Object.entries(policies as Record<string, unknown>)
    .map(([key, value]) => {
      const text = localized(value)
      return text ? `${labelOf(key)}: ${text}` : null
    })
    .filter(Boolean)
    .join('\n\n')
  if (policyText) {
    const policyHeader = `Event: ${event.name}\nEvent policy`
    splitText(policyText, MAX_CHUNK_CHARS - policyHeader.length - 2).forEach((piece, i) => {
      chunks.push({
        ...base,
        sourceType: 'EVENT_POLICY',
        chunkIndex: i,
        title: clip(`${event.name}: event policy`, MAX_TITLE_CHARS),
        content: `${policyHeader}\n\n${piece}`,
      })
    })
  }

  return chunks
}

/** Every PLATFORM chunk */
const platformChunks = (): ChunkInput[] =>
  platformRules().flatMap((rule) =>
    splitText(rule.text).map((piece, i) => ({
      sourceType: 'PLATFORM' as const,
      sourceId: rule.key,
      eventId: null,
      chunkIndex: i,
      title: clip(rule.title, MAX_TITLE_CHARS),
      content: piece,
    })),
  )

// ─── Writing chunks ─────────────────────────────────────────────────────────

type ExistingChunk = { id: string; sourceType: KnowledgeSource; sourceId: string; chunkIndex: number; contentHash: string }
const existingSelect = { id: true, sourceType: true, sourceId: true, chunkIndex: true, contentHash: true } as const

/**
 * Makes the table match `desired` within a scope: embeds new or changed chunks, skips unchanged
 * ones and deletes chunks in `existing` that are no longer wanted. Everything is embedded before
 * anything is written, so a Gemini failure leaves the old chunks in place.
 */
const syncChunks = async (desired: ChunkInput[], existing: ExistingChunk[], options: IndexOptions): Promise<IndexResult> => {
  const hashes = new Map(existing.map((c) => [keyOf(c), c.contentHash]))
  const withHashes = desired.map((c) => ({ ...c, hash: hashOf(c.title, c.content) }))
  const changed = withHashes.filter((c) => options.force || hashes.get(keyOf(c)) !== c.hash)

  const vectors = changed.length ? await getLlm().embedDocuments(changed.map((c) => ({ title: c.title, text: c.content }))) : []

  for (const [i, c] of changed.entries()) {
    // Prisma cannot write vector columns, so this insert is raw SQL (see vector.ts)
    await prisma.$executeRaw`
      INSERT INTO knowledge_chunks
        (id, source_type, source_id, event_id, chunk_index, title, content, content_hash, embedding, updated_at)
      VALUES
        (${crypto.randomUUID()}::uuid, ${c.sourceType}::"KnowledgeSource", ${c.sourceId}, ${c.eventId}::uuid, ${c.chunkIndex},
         ${c.title}, ${c.content}, ${c.hash}, ${toVectorLiteral(vectors[i])}::vector, now())
      ON CONFLICT (source_type, source_id, chunk_index) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        content_hash = EXCLUDED.content_hash,
        embedding = EXCLUDED.embedding,
        updated_at = now()`
  }

  const wanted = new Set(desired.map(keyOf))
  const stale = existing.filter((c) => !wanted.has(keyOf(c))).map((c) => c.id)
  if (stale.length) await prisma.knowledgeChunk.deleteMany({ where: { id: { in: stale } } })

  return { embedded: changed.length, unchanged: desired.length - changed.length, removed: stale.length }
}

// Indexing runs one job at a time, so a startup sync and an admin's save never embed the same
// event twice or race on the same rows
let queue: Promise<unknown> = Promise.resolve()
const oneAtATime = <T>(job: () => Promise<T>): Promise<T> => {
  const result = queue.then(job)
  queue = result.catch(() => undefined)
  return result
}

const eventSelect = {
  id: true,
  name: true,
  category: true,
  performer: true,
  description: true,
  about: true,
  policies: true,
  faqs: true,
  status: true,
  startAt: true,
  durationMinutes: true,
  venue: { select: { name: true, city: true } },
} as const

const hasEnded = (e: { startAt: Date; durationMinutes: number }) => e.startAt.getTime() + e.durationMinutes * 60_000 <= Date.now()
const isSearchable = (e: { status: string; startAt: Date; durationMinutes: number }) => e.status === 'PUBLISHED' && !hasEnded(e)

const syncEvent = async (eventId: string, options: IndexOptions): Promise<IndexResult> => {
  const [event, existing] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: eventSelect }),
    prisma.knowledgeChunk.findMany({ where: { eventId }, select: existingSelect }),
  ])
  // Deleted, draft, cancelled or finished: nothing of it should be searchable
  const desired = event && isSearchable(event) ? eventChunks(event) : []
  return syncChunks(desired, existing, options)
}

const syncPlatform = async (options: IndexOptions): Promise<IndexResult> => {
  const existing = await prisma.knowledgeChunk.findMany({ where: { sourceType: 'PLATFORM' }, select: existingSelect })
  return syncChunks(platformChunks(), existing, options)
}

// ─── Public entry points ────────────────────────────────────────────────────

/** Brings one event's chunks up to date (or removes them if it is no longer on sale) */
export const indexEvent = (eventId: string, options: IndexOptions = {}) => oneAtATime(() => syncEvent(eventId, options))

/** Brings the platform rules up to date */
export const indexPlatformRules = (options: IndexOptions = {}) => oneAtATime(() => syncPlatform(options))

/**
 * Full sync: platform rules, every searchable event, and removal of chunks whose event is gone,
 * cancelled or finished. Events are synced one by one, so one failure does not stop the rest.
 */
export const indexAll = (options: IndexOptions = {}) =>
  oneAtATime(async () => {
    let total = await syncPlatform(options)
    const failures: { eventId: string; error: string }[] = []

    const candidates = await prisma.event.findMany({
      where: { status: 'PUBLISHED', startAt: { gt: new Date(Date.now() - 2 * 86_400_000) } },
      select: { id: true, status: true, startAt: true, durationMinutes: true },
    })
    const searchable = candidates.filter(isSearchable).map((e) => e.id)
    for (const eventId of searchable) {
      try {
        total = add(total, await syncEvent(eventId, options))
      } catch (error) {
        failures.push({ eventId, error: error instanceof Error ? error.message : String(error) })
      }
    }

    // Chunks of events that are no longer searchable
    const { count } = await prisma.knowledgeChunk.deleteMany({
      where: { sourceType: { not: 'PLATFORM' }, OR: [{ eventId: null }, { eventId: { notIn: searchable } }] },
    })
    total = add(total, { ...EMPTY, removed: count })

    return { ...total, events: searchable.length, failures }
  })

/**
 * For services that change events: refreshes the event's chunks in the background.
 * Never throws and never delays the caller; a failure is logged and the next save or
 * server start fixes it. Does nothing when no AI provider is configured.
 */
export const refreshEventKnowledge = (eventId: string) => {
  if (!isLlmConfigured()) return
  indexEvent(eventId)
    .then((r) => {
      if (r.embedded || r.removed) console.log(`[intelligence] event ${eventId}: ${r.embedded} chunks embedded, ${r.removed} removed`)
    })
    .catch((error) => console.error(`[intelligence] could not index event ${eventId}:`, error instanceof Error ? error.message : error))
}

/** Server start: syncs everything in the background (seeds and finished events included) */
export const syncKnowledgeInBackground = () => {
  if (!isLlmConfigured()) return
  indexAll()
    .then((r) => {
      console.log(`[intelligence] knowledge base: ${r.events} events, ${r.embedded} chunks embedded, ${r.unchanged} unchanged, ${r.removed} removed`)
      for (const f of r.failures) console.error(`[intelligence] could not index event ${f.eventId}: ${f.error}`)
    })
    .catch((error) => console.error('[intelligence] knowledge sync failed:', error instanceof Error ? error.message : error))
}
