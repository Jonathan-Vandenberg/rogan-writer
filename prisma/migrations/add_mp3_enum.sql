-- Add MP3 to ExportFormat enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ExportFormat' AND e.enumlabel = 'MP3'
    ) THEN
        ALTER TYPE "ExportFormat" ADD VALUE 'MP3';
    END IF;
END $$;

