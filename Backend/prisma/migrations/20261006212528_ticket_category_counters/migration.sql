/*
  Warnings:

  - You are about to drop the column `remaining` on the `ticket_categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ticket_categories" DROP COLUMN "remaining",
ADD COLUMN     "held_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sold_count" INTEGER NOT NULL DEFAULT 0;

-- Availability can never go negative or past capacity, whatever the application does (BR-10, FR-TKT-11)
ALTER TABLE "ticket_categories" ADD CONSTRAINT "chk_ticket_categories_counts"
  CHECK ("held_count" >= 0 AND "sold_count" >= 0 AND "held_count" + "sold_count" <= "capacity");
