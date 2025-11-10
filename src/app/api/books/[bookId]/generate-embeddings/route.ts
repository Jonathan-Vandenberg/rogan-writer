import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { aiEmbeddingService } from '@/services/ai-embedding.service'

/**
 * Generate embeddings for all content in a book that doesn't have them yet
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params

    // Generate embeddings for all content that doesn't have them
    console.log(`🚀 Generating missing embeddings for book: ${bookId}`)
    
    const results = await aiEmbeddingService.generateBookEmbeddings(bookId)
    
    const totalGenerated = Object.values(results).reduce((sum, count) => sum + count, 0)
    
    return NextResponse.json({
      success: true,
      message: `Generated ${totalGenerated} embeddings`,
      details: results
    })
    
  } catch (error) {
    console.error('Error generating embeddings:', error)
    return NextResponse.json({ 
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Get embedding status for a book
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params

    // Get counts of items with and without embeddings
    const { prisma } = await import('@/lib/db')
    
    const [
      brainstormingTotal,
      brainstormingWithEmbedding,
      charactersTotal,
      charactersWithEmbedding,
      chaptersTotal,
      chaptersWithEmbedding,
      locationsTotal,
      locationsWithEmbedding,
      plotPointsTotal,
      plotPointsWithEmbedding,
    ] = await Promise.all([
      prisma.brainstormingNote.count({ where: { bookId } }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM brainstorming_notes WHERE "bookId" = ${bookId} AND embedding IS NOT NULL`,
      prisma.character.count({ where: { bookId } }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM characters WHERE "bookId" = ${bookId} AND embedding IS NOT NULL`,
      prisma.chapter.count({ where: { bookId } }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM chapters WHERE "bookId" = ${bookId} AND embedding IS NOT NULL`,
      prisma.location.count({ where: { bookId } }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM locations WHERE "bookId" = ${bookId} AND embedding IS NOT NULL`,
      prisma.plotPoint.count({ where: { bookId } }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM plot_points WHERE "bookId" = ${bookId} AND embedding IS NOT NULL`,
    ])

    const embeddingStatus = {
      brainstorming: {
        total: brainstormingTotal,
        withEmbedding: Number((brainstormingWithEmbedding as any)[0]?.count || 0),
        missing: brainstormingTotal - Number((brainstormingWithEmbedding as any)[0]?.count || 0)
      },
      characters: {
        total: charactersTotal,
        withEmbedding: Number((charactersWithEmbedding as any)[0]?.count || 0),
        missing: charactersTotal - Number((charactersWithEmbedding as any)[0]?.count || 0)
      },
      chapters: {
        total: chaptersTotal,
        withEmbedding: Number((chaptersWithEmbedding as any)[0]?.count || 0),
        missing: chaptersTotal - Number((chaptersWithEmbedding as any)[0]?.count || 0)
      },
      locations: {
        total: locationsTotal,
        withEmbedding: Number((locationsWithEmbedding as any)[0]?.count || 0),
        missing: locationsTotal - Number((locationsWithEmbedding as any)[0]?.count || 0)
      },
      plotPoints: {
        total: plotPointsTotal,
        withEmbedding: Number((plotPointsWithEmbedding as any)[0]?.count || 0),
        missing: plotPointsTotal - Number((plotPointsWithEmbedding as any)[0]?.count || 0)
      }
    }

    const totalMissing = Object.values(embeddingStatus).reduce((sum, item) => sum + item.missing, 0)

    return NextResponse.json({
      bookId,
      totalMissingEmbeddings: totalMissing,
      embeddingStatus
    })
    
  } catch (error) {
    console.error('Error getting embedding status:', error)
    return NextResponse.json({ 
      error: 'Failed to get embedding status'
    }, { status: 500 })
  }
}
