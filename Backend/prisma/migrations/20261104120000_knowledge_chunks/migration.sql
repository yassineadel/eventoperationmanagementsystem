-- Chatbot retrieval layer (RAG): pgvector stores the meaning of event text and platform rules.
-- Supabase and the pgvector/pgvector Docker image ship the extension; a plain local
-- PostgreSQL needs pgvector installed before this migration can run.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('EVENT', 'EVENT_FAQ', 'EVENT_POLICY', 'PLATFORM');

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "source_type" "KnowledgeSource" NOT NULL,
    "source_id" VARCHAR(100) NOT NULL,
    "event_id" UUID,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(300) NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "embedding" vector(768) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_source_type_source_id_chunk_index_key" ON "knowledge_chunks"("source_type", "source_id", "chunk_index");

-- CreateIndex
CREATE INDEX "knowledge_chunks_event_id_idx" ON "knowledge_chunks"("event_id");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No approximate (HNSW) vector index on purpose: a few thousand chunks are searched exactly in
-- milliseconds, and Prisma cannot describe such an index, so `prisma migrate dev` would try to drop it.
