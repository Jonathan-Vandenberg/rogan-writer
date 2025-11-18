-- Safe migration: Create brainstorming_workspaces table
-- This only adds a new table and won't affect existing data

CREATE TABLE IF NOT EXISTS "brainstorming_workspaces" (
    "id" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookId" TEXT NOT NULL,
    CONSTRAINT "brainstorming_workspaces_pkey" PRIMARY KEY ("id")
);

-- Create unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS "brainstorming_workspaces_bookId_key" ON "brainstorming_workspaces"("bookId");

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'brainstorming_workspaces_bookId_fkey'
    ) THEN
        ALTER TABLE "brainstorming_workspaces" 
        ADD CONSTRAINT "brainstorming_workspaces_bookId_fkey" 
        FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

