-- AlterEnum
BEGIN;
CREATE TYPE "public"."ExportFormat_new" AS ENUM ('PDF', 'TXT', 'HTML');
ALTER TABLE "public"."exports" ALTER COLUMN "format" TYPE "public"."ExportFormat_new" USING ("format"::text::"public"."ExportFormat_new");
ALTER TYPE "public"."ExportFormat" RENAME TO "ExportFormat_old";
ALTER TYPE "public"."ExportFormat_new" RENAME TO "ExportFormat";
DROP TYPE "public"."ExportFormat_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."research_sessions" DROP CONSTRAINT "research_sessions_bookId_fkey";

-- DropForeignKey
ALTER TABLE "public"."research_sessions" DROP CONSTRAINT "research_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."book_embedding_chunks" DROP CONSTRAINT "book_embedding_chunks_bookId_fkey";

-- DropTable
DROP TABLE "public"."research_sessions";

-- DropTable
DROP TABLE "public"."book_embedding_chunks";

-- CreateTable
CREATE TABLE "public"."ResearchSession" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "sourcesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration" INTEGER,
    "successful" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchSession_bookId_idx" ON "public"."ResearchSession"("bookId" ASC);

-- CreateIndex
CREATE INDEX "ResearchSession_createdAt_idx" ON "public"."ResearchSession"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ResearchSession_userId_idx" ON "public"."ResearchSession"("userId" ASC);

-- AddForeignKey
ALTER TABLE "public"."ResearchSession" ADD CONSTRAINT "ResearchSession_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchSession" ADD CONSTRAINT "ResearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

