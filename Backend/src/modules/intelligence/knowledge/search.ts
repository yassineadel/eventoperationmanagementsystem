/**
 * Retrieval: finds the knowledge-base chunks closest in meaning to a question.
 * The question is embedded the same way as the chunks (llm.embedQuery), then pgvector compares
 * them with cosine distance (<=>): 0 means the same meaning, 2 the opposite.
 */
import type { KnowledgeSource } from '@prisma/client'
import prisma from '../../../config/db'
import { getLlm } from '../llm'
import { toVectorLiteral } from './vector'

export type KnowledgeHit = {
  sourceType: KnowledgeSource
  sourceId: string
  eventId: string | null
  title: string
  content: string
  distance: number
}

// How many chunks to give the model. Enough to cover an event's description, policy and a
// platform rule together, few enough that unrelated text does not crowd the answer.
const MAX_HITS = 6
// Chunks further than this are about something else and only confuse the answer. In ai:check a
// matching text scored about 0.19 and an unrelated one about 0.39; 0.5 leaves room for loosely
// worded questions while still dropping unrelated text.
const MAX_DISTANCE = 0.5

/** The chunks that best match the question, closest first; empty if nothing is close enough */
export const searchKnowledge = async (question: string, limit = MAX_HITS): Promise<KnowledgeHit[]> => {
  const vector = toVectorLiteral(await getLlm().embedQuery(question))
  // Exact search: a few thousand chunks are compared in milliseconds (see the migration)
  const rows = await prisma.$queryRaw<
    { source_type: KnowledgeSource; source_id: string; event_id: string | null; title: string; content: string; distance: number }[]
  >`
    SELECT source_type, source_id, event_id::text AS event_id, title, content,
           (embedding <=> ${vector}::vector)::float8 AS distance
    FROM knowledge_chunks
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${limit}`
  return rows
    .filter((r) => r.distance <= MAX_DISTANCE)
    .map((r) => ({
      sourceType: r.source_type,
      sourceId: r.source_id,
      eventId: r.event_id,
      title: r.title,
      content: r.content,
      distance: r.distance,
    }))
}

/**
 * Events whose description is closest in meaning to a wish such as "something loud and energetic"
 * or "a calm evening for a family", closest first. Searches only event descriptions (EVENT chunks),
 * so it can find a techno night from words that never appear in its name.
 */
export const searchEventsByMeaning = async (wish: string, limit = 20): Promise<{ eventId: string; distance: number }[]> => {
  const vector = toVectorLiteral(await getLlm().embedQuery(wish))
  const rows = await prisma.$queryRaw<{ event_id: string; distance: number }[]>`
    SELECT event_id::text AS event_id, MIN((embedding <=> ${vector}::vector)::float8) AS distance
    FROM knowledge_chunks
    WHERE source_type = 'EVENT' AND event_id IS NOT NULL
    GROUP BY event_id
    ORDER BY distance
    LIMIT ${limit}`
  return rows.map((r) => ({ eventId: r.event_id, distance: r.distance }))
}
