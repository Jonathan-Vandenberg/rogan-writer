-- Migration: Add vector embeddings to content tables
-- This adds semantic search capabilities to all major content types

-- AddColumn to chapters
ALTER TABLE "public"."chapters" ADD COLUMN "embedding" vector(1536);

-- AddColumn to locations  
ALTER TABLE "public"."locations" ADD COLUMN "embedding" vector(1536);

-- AddColumn to plot_points
ALTER TABLE "public"."plot_points" ADD COLUMN "embedding" vector(1536);

-- AddColumn to timeline_events
ALTER TABLE "public"."timeline_events" ADD COLUMN "embedding" vector(1536);

-- AddColumn to scene_cards
ALTER TABLE "public"."scene_cards" ADD COLUMN "embedding" vector(1536);
