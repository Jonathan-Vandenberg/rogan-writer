-- CreateTable
CREATE TABLE "book_embedding_chunks" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_embedding_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_embedding_chunks_bookId_sourceType_idx" ON "book_embedding_chunks"("bookId", "sourceType");

-- CreateIndex
CREATE INDEX "book_embedding_chunks_bookId_sourceId_idx" ON "book_embedding_chunks"("bookId", "sourceId");

-- AddForeignKey
ALTER TABLE "book_embedding_chunks" ADD CONSTRAINT "book_embedding_chunks_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

