-- Chatbot mood analytics: one row per question from a visitor or customer, with the mood the
-- chatbot read in it and what it was about. No message text and no user id (no personal data).

-- CreateEnum
CREATE TYPE "ChatMoodKind" AS ENUM ('CALM', 'CONFUSED', 'FRUSTRATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ChatAsker" AS ENUM ('VISITOR', 'CUSTOMER');

-- CreateTable
CREATE TABLE "chat_moods" (
    "id" UUID NOT NULL,
    "mood" "ChatMoodKind" NOT NULL,
    "asker" "ChatAsker" NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "topic" VARCHAR(50) NOT NULL,
    "event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_moods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_moods_created_at_idx" ON "chat_moods"("created_at");

-- CreateIndex
CREATE INDEX "chat_moods_event_id_idx" ON "chat_moods"("event_id");

-- AddForeignKey
ALTER TABLE "chat_moods" ADD CONSTRAINT "chat_moods_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
