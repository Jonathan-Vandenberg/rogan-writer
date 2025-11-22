-- Add new model fields for chat and TTS
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "openRouterChatModel" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "openRouterTTSModel" TEXT;

-- Add TTS settings
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ttsVoice" TEXT DEFAULT 'alloy';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ttsModel" TEXT DEFAULT 'tts-1';

-- Add temperature for editor and chat (rename defaultModelTemperature to editorModelTemperature)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "editorModelTemperature" FLOAT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chatModelTemperature" FLOAT;

-- Migrate existing defaultModelTemperature to editorModelTemperature
UPDATE "users" SET "editorModelTemperature" = "defaultModelTemperature" WHERE "editorModelTemperature" IS NULL AND "defaultModelTemperature" IS NOT NULL;

-- Set defaults for new temperature fields
UPDATE "users" SET "editorModelTemperature" = 0.7 WHERE "editorModelTemperature" IS NULL;
UPDATE "users" SET "chatModelTemperature" = 0.7 WHERE "chatModelTemperature" IS NULL;

-- Note: We keep defaultModelTemperature for backward compatibility but it's deprecated
-- The openRouterDefaultModel field is also kept for backward compatibility

