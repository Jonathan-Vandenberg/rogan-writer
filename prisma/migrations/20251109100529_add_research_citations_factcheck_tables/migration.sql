-- CreateEnum
CREATE TYPE "ResearchSource" AS ENUM ('WIKIPEDIA', 'SCHOLARLY', 'NEWS', 'GOVERNMENT', 'BOOKS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CitationFormat" AS ENUM ('APA', 'MLA', 'CHICAGO');

-- CreateEnum
CREATE TYPE "FactCheckStatus" AS ENUM ('VERIFIED', 'DISPUTED', 'UNCERTAIN', 'REQUIRES_REVIEW');

-- CreateTable
CREATE TABLE "ResearchResult" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "sourceType" "ResearchSource" NOT NULL,
    "sourceUrl" VARCHAR(1000),
    "credibilityScore" INTEGER NOT NULL DEFAULT 0,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" VARCHAR(1000),
    "publishedAt" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "ResearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "researchResultId" TEXT,
    "chapterId" TEXT,
    "claimText" TEXT,
    "format" "CitationFormat" NOT NULL,
    "citationText" TEXT NOT NULL,
    "bibliographyEntry" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "inlineLocation" VARCHAR(200),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactCheck" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT,
    "researchResultId" TEXT,
    "claim" VARCHAR(1000) NOT NULL,
    "status" "FactCheckStatus" NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "verificationSources" JSONB NOT NULL DEFAULT '[]',
    "conflictingSources" JSONB DEFAULT '[]',
    "recommendations" TEXT,
    "verifiedBy" VARCHAR(100),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSession" (
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
CREATE INDEX "ResearchResult_bookId_idx" ON "ResearchResult"("bookId");

-- CreateIndex
CREATE INDEX "ResearchResult_sourceType_idx" ON "ResearchResult"("sourceType");

-- CreateIndex
CREATE INDEX "ResearchResult_credibilityScore_idx" ON "ResearchResult"("credibilityScore");

-- CreateIndex
CREATE INDEX "Citation_bookId_idx" ON "Citation"("bookId");

-- CreateIndex
CREATE INDEX "Citation_format_idx" ON "Citation"("format");

-- CreateIndex
CREATE INDEX "Citation_chapterId_idx" ON "Citation"("chapterId");

-- CreateIndex
CREATE INDEX "FactCheck_bookId_idx" ON "FactCheck"("bookId");

-- CreateIndex
CREATE INDEX "FactCheck_status_idx" ON "FactCheck"("status");

-- CreateIndex
CREATE INDEX "FactCheck_confidenceScore_idx" ON "FactCheck"("confidenceScore");

-- CreateIndex
CREATE INDEX "ResearchSession_bookId_idx" ON "ResearchSession"("bookId");

-- CreateIndex
CREATE INDEX "ResearchSession_userId_idx" ON "ResearchSession"("userId");

-- CreateIndex
CREATE INDEX "ResearchSession_createdAt_idx" ON "ResearchSession"("createdAt");

-- AddForeignKey
ALTER TABLE "ResearchResult" ADD CONSTRAINT "ResearchResult_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_researchResultId_fkey" FOREIGN KEY ("researchResultId") REFERENCES "ResearchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactCheck" ADD CONSTRAINT "FactCheck_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactCheck" ADD CONSTRAINT "FactCheck_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactCheck" ADD CONSTRAINT "FactCheck_researchResultId_fkey" FOREIGN KEY ("researchResultId") REFERENCES "ResearchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSession" ADD CONSTRAINT "ResearchSession_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSession" ADD CONSTRAINT "ResearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

