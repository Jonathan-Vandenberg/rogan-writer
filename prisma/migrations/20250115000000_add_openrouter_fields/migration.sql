-- Add OpenRouter API configuration fields to users table
-- This migration safely adds columns only if they don't already exist

DO $$ 
BEGIN
    -- Add openRouterApiKey column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'openRouterApiKey'
    ) THEN
        ALTER TABLE "public"."users" ADD COLUMN "openRouterApiKey" TEXT;
    END IF;

    -- Add openRouterEmbeddingModel column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'openRouterEmbeddingModel'
    ) THEN
        ALTER TABLE "public"."users" ADD COLUMN "openRouterEmbeddingModel" TEXT;
    END IF;

    -- Add openRouterResearchModel column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'openRouterResearchModel'
    ) THEN
        ALTER TABLE "public"."users" ADD COLUMN "openRouterResearchModel" TEXT;
    END IF;

    -- Add openRouterSuggestionsModel column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'openRouterSuggestionsModel'
    ) THEN
        ALTER TABLE "public"."users" ADD COLUMN "openRouterSuggestionsModel" TEXT;
    END IF;

    -- Add openRouterDefaultModel column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'openRouterDefaultModel'
    ) THEN
        ALTER TABLE "public"."users" ADD COLUMN "openRouterDefaultModel" TEXT;
    END IF;
END $$;


