-- Homepage carousel: admins choose which events appear in it from the console.

-- AlterTable
ALTER TABLE "events" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;
