/// <reference types="node" />
// Fills the chatbot's knowledge base (knowledge_chunks) from the platform rules and every published
// event that has not ended. Run with: npm run ai:index
//   npm run ai:index -- --force   re-embeds everything (needed after changing GEMINI_EMBEDDING_MODEL)
// Safe to run again: unchanged texts are skipped and cost no Gemini requests.
// The server also runs this sync on start, and refreshes an event whenever an admin saves it.
import prisma from '../config/db'
import { getLlm, isLlmConfigured } from '../modules/intelligence/llm'
import { indexAll } from '../modules/intelligence/knowledge/indexer'

async function main() {
  if (!isLlmConfigured()) {
    console.error('FAIL  GEMINI_API_KEY is not set in Backend/.env (create one at https://aistudio.google.com/apikey)')
    process.exit(1)
  }
  const force = process.argv.includes('--force')
  console.log(`Indexing with ${getLlm().name}${force ? ' (forced: every chunk is re-embedded)' : ''}…`)

  const started = Date.now()
  const result = await indexAll({ force })

  console.log(`Events indexed:     ${result.events}`)
  console.log(`Chunks embedded:    ${result.embedded}`)
  console.log(`Chunks unchanged:   ${result.unchanged}`)
  console.log(`Chunks removed:     ${result.removed}`)
  for (const f of result.failures) console.error(`FAIL  event ${f.eventId}: ${f.error}`)

  const counts = await prisma.$queryRaw<{ source_type: string; count: bigint }[]>`
    SELECT source_type::text, COUNT(*) AS count FROM knowledge_chunks GROUP BY source_type ORDER BY source_type`
  console.log(`\nKnowledge base now holds: ${counts.map((c) => `${c.count} ${c.source_type}`).join(', ') || 'nothing'}`)
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s`)

  await prisma.$disconnect()
  return result.failures.length ? 1 : 0
}

// process.exit: the services the platform rules read their numbers from open Redis and queue
// connections on import, which would otherwise keep this script running
main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`FAIL  ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
