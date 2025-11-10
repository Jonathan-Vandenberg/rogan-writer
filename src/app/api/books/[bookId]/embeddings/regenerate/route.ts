import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unifiedEmbeddingService } from '@/services/unified-embedding.service'

/**
 * Regenerate all embeddings for a book
 * POST /api/books/[bookId]/embeddings/regenerate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
      }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    console.log(`🔄 Starting embedding regeneration for book: ${book.title}`)

    // Regenerate all embeddings
    await unifiedEmbeddingService.regenerateBookEmbeddings(bookId)

    // Get stats on what was created
    const chunks = await prisma.bookEmbeddingChunk.groupBy({
      by: ['sourceType'],
      where: { bookId },
      _count: true
    })

    const stats = chunks.reduce((acc, item) => {
      acc[item.sourceType] = item._count
      return acc
    }, {} as Record<string, number>)

    console.log(`✅ Embedding regeneration complete for book: ${book.title}`, stats)

    return NextResponse.json({
      success: true,
      message: 'Embeddings regenerated successfully',
      stats
    })

  } catch (error) {
    console.error('Error regenerating embeddings:', error)
    return NextResponse.json({ 
      error: 'Failed to regenerate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

