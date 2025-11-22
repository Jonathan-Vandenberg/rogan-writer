-- Add modelPreferences JSON field to store per-model, per-agent preferences
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "modelPreferences" JSONB DEFAULT '{}'::jsonb;

