-- AlterTable
-- Add columns only if they don't already exist
DO $$
BEGIN
    -- Add chapterTitleFontFamily
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'books' 
        AND column_name = 'chapterTitleFontFamily'
    ) THEN
        ALTER TABLE "books" ADD COLUMN "chapterTitleFontFamily" TEXT NOT NULL DEFAULT 'Verdana';
    END IF;

    -- Add chapterTitleFontSize
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'books' 
        AND column_name = 'chapterTitleFontSize'
    ) THEN
        ALTER TABLE "books" ADD COLUMN "chapterTitleFontSize" INTEGER NOT NULL DEFAULT 26;
    END IF;

    -- Add chapterTitleAlignment
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'books' 
        AND column_name = 'chapterTitleAlignment'
    ) THEN
        ALTER TABLE "books" ADD COLUMN "chapterTitleAlignment" TEXT NOT NULL DEFAULT 'center';
    END IF;

    -- Add chapterTitlePadding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'books' 
        AND column_name = 'chapterTitlePadding'
    ) THEN
        ALTER TABLE "books" ADD COLUMN "chapterTitlePadding" INTEGER NOT NULL DEFAULT 65;
    END IF;

    -- Add showChapterTitle
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'books' 
        AND column_name = 'showChapterTitle'
    ) THEN
        ALTER TABLE "books" ADD COLUMN "showChapterTitle" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;