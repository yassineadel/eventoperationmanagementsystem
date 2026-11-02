-- Venues can be created and edited from the admin console: keep the layout, photo and map link in the database
ALTER TABLE "venues" ADD COLUMN "layout" JSONB;
ALTER TABLE "venues" ADD COLUMN "image" TEXT;
ALTER TABLE "venues" ADD COLUMN "map_url" TEXT;
