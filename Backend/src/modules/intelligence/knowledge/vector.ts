/**
 * Helpers for the pgvector column in knowledge_chunks.
 * Prisma cannot read or write vector columns, so queries pass vectors as text, e.g.
 *   prisma.$queryRaw`... ORDER BY embedding <=> ${toVectorLiteral(v)}::vector ...`
 */

/** Must match vector(768) in the knowledge_chunks migration. */
export const EMBEDDING_DIMENSIONS = 768

/** Formats a vector as pgvector text ('[0.1,0.2,…]'), refusing anything the column would reject. */
export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} numbers in an embedding, got ${values.length}`)
  }
  if (!values.every(Number.isFinite)) throw new Error('An embedding contains a value that is not a number')
  return `[${values.join(',')}]`
}
