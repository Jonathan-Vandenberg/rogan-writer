-- AlterTable
ALTER TABLE "books" ADD COLUMN     "chapterTitleFontFamily" TEXT NOT NULL DEFAULT 'Verdana',
ADD COLUMN     "chapterTitleFontSize" INTEGER NOT NULL DEFAULT 26,
ADD COLUMN     "chapterTitleAlignment" TEXT NOT NULL DEFAULT 'center',
ADD COLUMN     "chapterTitlePadding" INTEGER NOT NULL DEFAULT 65,
ADD COLUMN     "showChapterTitle" BOOLEAN NOT NULL DEFAULT true;