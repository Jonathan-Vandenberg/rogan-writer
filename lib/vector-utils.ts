import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface EmbeddingVector {
  embedding: number[]
}

/**
 * Convert number array to PostgreSQL vector format
 */
export function arrayToVector(array: number[]): string {
  return `[${array.join(',')}]`
}

/**
 * Convert PostgreSQL vector to number array
 */
export function vectorToArray(vector: string): number[] {
  return vector.slice(1, -1).split(',').map(Number)
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Find similar pages based on vector similarity
 */
export async function findSimilarPages(
  bookId: string,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.7
) {
  const vectorStr = arrayToVector(queryEmbedding)
  
  // Using raw SQL for vector similarity search
  const result = await prisma.$queryRaw`
    SELECT 
      id,
      content,
      "pageNumber",
      "chapterId",
      embedding <=> ${vectorStr}::vector as distance
    FROM pages 
    WHERE 
      "chapterId" IN (
        SELECT id FROM chapters WHERE "bookId" = ${bookId}
      )
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> ${vectorStr}::vector)) >= ${threshold}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `
  
  return result
}

/**
 * Find similar characters based on vector similarity
 */
export async function findSimilarCharacters(
  bookId: string,
  queryEmbedding: number[],
  limit: number = 3
) {
  const vectorStr = arrayToVector(queryEmbedding)
  
  const result = await prisma.$queryRaw`
    SELECT 
      id,
      name,
      description,
      role,
      embedding <=> ${vectorStr}::vector as distance
    FROM characters 
    WHERE 
      "bookId" = ${bookId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `
  
  return result
}

/**
 * Find similar brainstorming notes based on vector similarity
 */
export async function findSimilarBrainstormingNotes(
  bookId: string,
  queryEmbedding: number[],
  limit: number = 5
) {
  const vectorStr = arrayToVector(queryEmbedding)
  
  const result = await prisma.$queryRaw`
    SELECT 
      id,
      title,
      content,
      tags,
      embedding <=> ${vectorStr}::vector as distance
    FROM brainstorming_notes 
    WHERE 
      "bookId" = ${bookId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `
  
  return result
}

/**
 * Find similar research items based on vector similarity
 */
export async function findSimilarResearchItems(
  bookId: string,
  queryEmbedding: number[],
  limit: number = 5
) {
  const vectorStr = arrayToVector(queryEmbedding)
  
  const result = await prisma.$queryRaw`
    SELECT 
      id,
      title,
      content,
      url,
      tags,
      "itemType",
      embedding <=> ${vectorStr}::vector as distance
    FROM research_items 
    WHERE 
      "bookId" = ${bookId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `
  
  return result
}

/**
 * Update page embedding
 */
export async function updatePageEmbedding(
  pageId: string,
  embedding: number[]
) {
  const vectorStr = arrayToVector(embedding)
  
  await prisma.$executeRaw`
    UPDATE pages 
    SET embedding = ${vectorStr}::vector 
    WHERE id = ${pageId}
  `
}

/**
 * Update character embedding
 */
export async function updateCharacterEmbedding(
  characterId: string,
  embedding: number[]
) {
  const vectorStr = arrayToVector(embedding)
  
  await prisma.$executeRaw`
    UPDATE characters 
    SET embedding = ${vectorStr}::vector 
    WHERE id = ${characterId}
  `
}

/**
 * Update brainstorming note embedding
 */
export async function updateBrainstormingNoteEmbedding(
  noteId: string,
  embedding: number[]
) {
  const vectorStr = arrayToVector(embedding)
  
  await prisma.$executeRaw`
    UPDATE brainstorming_notes 
    SET embedding = ${vectorStr}::vector 
    WHERE id = ${noteId}
  `
}

/**
 * Update research item embedding
 */
export async function updateResearchItemEmbedding(
  itemId: string,
  embedding: number[]
) {
  const vectorStr = arrayToVector(embedding)
  
  await prisma.$executeRaw`
    UPDATE research_items 
    SET embedding = ${vectorStr}::vector 
    WHERE id = ${itemId}
  `
}

/**
 * Get all content for book context (for AI assistant)
 */
export async function getBookContext(bookId: string) {
  const [book, chapters, characters, plotPoints, notes, research] = await Promise.all([
    // Book details
    prisma.book.findUnique({
      where: { id: bookId },
      include: {
        author: { select: { name: true, email: true } }
      }
    }),
    
    // All chapters with pages
    prisma.chapter.findMany({
      where: { bookId },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' }
        }
      },
      orderBy: { orderIndex: 'asc' }
    }),
    
    // All characters
    prisma.character.findMany({
      where: { bookId },
      include: {
        relationships: {
          include: {
            characterTo: { select: { name: true } }
          }
        }
      }
    }),
    
    // Plot structure
    prisma.plotPoint.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' }
    }),
    
    // Brainstorming notes
    prisma.brainstormingNote.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' }
    }),
    
    // Research items
    prisma.researchItem.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' }
    })
  ])

  return {
    book,
    chapters,
    characters,
    plotPoints,
    notes,
    research
  }
} 