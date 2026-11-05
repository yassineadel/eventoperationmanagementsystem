/// <reference types="node" />
// Checks everything the chatbot needs before any feature is built on it. Run with: npm run ai:check
//   1. GEMINI_API_KEY is set and Gemini answers
//   2. Embeddings come back with the size the database expects
//   3. The database has pgvector and the knowledge_chunks table (the migration ran)
//   4. A similarity search ranks a related text above an unrelated one
import prisma from '../config/db'
import { getLlm, isLlmConfigured } from '../modules/intelligence/llm'
import { EMBEDDING_DIMENSIONS, toVectorLiteral } from '../modules/intelligence/knowledge/vector'

const pass = (message: string) => console.log(`OK    ${message}`)
const fail = (message: string): never => {
  console.error(`FAIL  ${message}`)
  process.exit(1)
}
const seconds = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)} s`

// Runs one check and names it in the error, so a failure says which part of the chain broke
async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    return fail(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  if (!isLlmConfigured()) fail('GEMINI_API_KEY is not set in Backend/.env (create one at https://aistudio.google.com/apikey)')
  const llm = getLlm()
  pass(`Provider: ${llm.name}`)

  let started = Date.now()
  const reply = await step('Chat model', () =>
    llm.generate({
      system: 'You are a connection test. Reply with the single word READY.',
      turns: [{ role: 'user', text: 'Are you there?' }],
      maxOutputTokens: 200,
    }),
  )
  pass(`Chat model replied "${reply.slice(0, 40)}" in ${seconds(started)}`)

  started = Date.now()
  const [refunds, parking] = await step('Embedding model', () =>
    llm.embedDocuments([
      { title: 'Refund policy', text: 'Refunds can be requested up to seven days before the event starts.' },
      { title: 'Parking', text: 'The venue has free parking for two hundred cars next to gate B.' },
    ]),
  )
  const question = await step('Embedding model', () => llm.embedQuery('Can I get my money back if I cannot attend?'))
  pass(`Embedding model answered in ${seconds(started)}`)
  if (refunds.length !== EMBEDDING_DIMENSIONS) fail(`Embeddings have ${refunds.length} numbers, expected ${EMBEDDING_DIMENSIONS}`)
  pass(`Embeddings have ${EMBEDDING_DIMENSIONS} numbers`)

  const [extension] = await prisma.$queryRaw<{ extversion: string }[]>`SELECT extversion FROM pg_extension WHERE extname = 'vector'`
  if (!extension) fail('pgvector is not enabled in this database. Run: npx prisma migrate deploy')
  pass(`pgvector ${extension.extversion} is enabled`)

  const [table] = await prisma.$queryRaw<{ name: string | null }[]>`SELECT to_regclass('public.knowledge_chunks')::text AS name`
  if (!table?.name) fail('The knowledge_chunks table is missing. Run: npx prisma migrate deploy')
  pass('knowledge_chunks table exists')

  // <=> is pgvector's cosine distance: smaller means closer in meaning
  const [distances] = await prisma.$queryRaw<{ refunds: number; parking: number }[]>`
    SELECT ${toVectorLiteral(question)}::vector <=> ${toVectorLiteral(refunds)}::vector AS refunds,
           ${toVectorLiteral(question)}::vector <=> ${toVectorLiteral(parking)}::vector AS parking`
  const detail = `refund text ${distances.refunds.toFixed(3)} vs parking text ${distances.parking.toFixed(3)}`
  if (distances.refunds >= distances.parking) fail(`Search ranked the unrelated text first (${detail})`)
  pass(`Search finds the refund text for a refund question (${detail})`)

  console.log('\nThe chatbot foundation is ready.')
}

main()
  .catch((error) => {
    console.error(`FAIL  ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
