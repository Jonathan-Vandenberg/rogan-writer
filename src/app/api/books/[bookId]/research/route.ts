import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { researchApiService } from '@/services/research-api.service'
import { isNonFictionBook } from '@/lib/genre-utils'

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
    const { query, sources = ['wikipedia', 'scholarly', 'news'] } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Verify book ownership and check if it's non-fiction
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        genre: true
      }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Only allow research for non-fiction books
    if (!isNonFictionBook(book.genre)) {
      return NextResponse.json({ 
        error: 'Research is only available for non-fiction books',
        suggestion: 'Change your book genre to a non-fiction category to enable research features'
      }, { status: 403 })
    }

    console.log(`🔍 Research request for "${book.title}": "${query}"`)

    // Perform comprehensive research
    const researchResults = await researchApiService.performComprehensiveResearch(
      query, 
      sources.filter((s: string) => ['wikipedia', 'scholarly', 'news'].includes(s))
    )

    // Store research results in database for future reference
    const storedResults = await Promise.all(
      researchResults.slice(0, 10).map(async (result) => {
        try {
          const savedResult = await prisma.researchResult.create({
            data: {
              bookId: book.id,
              query: query,
              title: result.title,
              summary: result.summary || '',
              content: result.content,
              sourceType: result.source.toUpperCase() as any,
              sourceUrl: result.url,
              credibilityScore: result.credibilityScore,
              authors: result.authors || [],
              tags: result.tags || [],
              imageUrl: result.imageUrl,
              publishedAt: result.lastUpdated,
              lastUpdated: result.lastUpdated
            }
          })
          return savedResult
        } catch (error) {
          console.error('Failed to store research result:', error)
          return null
        }
      })
    )

    // Update research results with database IDs for frontend use
    const resultsWithDbIds = researchResults.map((result, index) => {
      const savedResult = storedResults[index]
      return {
        ...result,
        // Replace temporary ID with database ID for citation creation
        id: savedResult?.id || result.id,
        dbId: savedResult?.id // Keep both for reference
      }
    })

    // Log research session for analytics
    try {
      await prisma.researchSession.create({
        data: {
          bookId: book.id,
          userId: session.user.id,
          query: query,
          resultsCount: researchResults.length,
          sourcesUsed: sources,
          successful: researchResults.length > 0
        }
      })
    } catch (error) {
      console.error('Failed to log research session:', error)
    }

    console.log(`✅ Research complete: ${researchResults.length} results found, ${storedResults.filter(Boolean).length} stored with database IDs`)

    return NextResponse.json({
      success: true,
      query: query,
      results: resultsWithDbIds, // Return results with database IDs
      storedCount: storedResults.filter(Boolean).length,
      sources: sources
    })

  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json({ 
      error: 'Failed to perform research',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get stored research results for a book
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const source = searchParams.get('source') // Filter by source type

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: { id: true, title: true }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Build query conditions
    const whereConditions: any = { bookId }
    if (source && ['WIKIPEDIA', 'SCHOLARLY', 'NEWS', 'GOVERNMENT', 'BOOKS'].includes(source.toUpperCase())) {
      whereConditions.sourceType = source.toUpperCase()
    }

    // Get stored research results
    const researchResults = await prisma.researchResult.findMany({
      where: whereConditions,
      orderBy: [
        { credibilityScore: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
      include: {
        citations: {
          select: {
            id: true,
            format: true,
            citationText: true
          }
        },
        factChecks: {
          select: {
            id: true,
            status: true,
            confidenceScore: true
          }
        }
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.researchResult.count({
      where: whereConditions
    })

    return NextResponse.json({
      success: true,
      results: researchResults,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Get research results error:', error)
    return NextResponse.json({ 
      error: 'Failed to get research results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Delete a research result
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const resultId = searchParams.get('resultId')

    if (!resultId) {
      return NextResponse.json({ error: 'Research result ID is required' }, { status: 400 })
    }

    // Verify book ownership and result exists
    const existingResult = await prisma.researchResult.findFirst({
      where: {
        id: resultId,
        bookId: bookId,
        book: {
          userId: session.user.id
        }
      }
    })

    if (!existingResult) {
      return NextResponse.json({ error: 'Research result not found' }, { status: 404 })
    }

    // Delete research result
    await prisma.researchResult.delete({
      where: { id: resultId }
    })

    console.log(`🗑️ Deleted research result: ${existingResult.title}`)

    return NextResponse.json({
      success: true,
      message: 'Research result deleted successfully'
    })

  } catch (error) {
    console.error('Delete research result error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete research result',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
