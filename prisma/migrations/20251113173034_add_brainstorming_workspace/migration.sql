-- CreateTable: Add brainstorming workspace table for Excalidraw data storage
CREATE TABLE "brainstorming_workspaces" (
    "id" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "brainstorming_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Create unique index on bookId for one-to-one relationship
CREATE UNIQUE INDEX "brainstorming_workspaces_bookId_key" ON "brainstorming_workspaces"("bookId");

-- AddForeignKey: Link workspace to book with cascade delete
ALTER TABLE "brainstorming_workspaces" ADD CONSTRAINT "brainstorming_workspaces_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

