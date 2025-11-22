-- Add openRouterEditorModel field to users table
-- This migration safely adds the column only if it doesn't already exist

DO $$ 
BEGIN
    -- Add openRouterEditorModel column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'openRouterEditorModel'
    ) THEN
        ALTER TABLE "public"."users" ADD COLUMN "openRouterEditorModel" TEXT;
    END IF;
END $$;

