import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { researchApiService, ResearchResult } from '@/services/research-api.service'
import { isNonFictionBook, getPreferredCitationFormats } from '@/lib/genre-utils'

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
    const { 
      researchResultId, 
      chapterId, 
      claimText, 
      format = 'apa', 
      pageNumber,
      inlineLocation,
      notes 
    } = await request.json()

    if (!researchResultId && !claimText) {
      return NextResponse.json({ 
        error: 'Either researchResultId or claimText is required' 
      }, { status: 400 })
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

    if (!isNonFictionBook(book.genre)) {
      return NextResponse.json({ 
        error: 'Citations are only available for non-fiction books' 
      }, { status: 403 })
    }

    let citationText = ''
    let bibliographyEntry = ''

    if (researchResultId) {
      // Generate citation from stored research result
      const researchResult = await prisma.researchResult.findFirst({
        where: {
          id: researchResultId,
          bookId: book.id
        }
      })

      if (!researchResult) {
        return NextResponse.json({ 
          error: 'Research result not found' 
        }, { status: 404 })
      }

      // Convert to ResearchResult format for citation generation
      const result = {
        id: researchResult.id,
        title: researchResult.title,
        summary: researchResult.summary || '',
        content: researchResult.content || undefined,
        source: researchResult.sourceType.toLowerCase() as any,
        url: researchResult.sourceUrl || '',
        credibilityScore: researchResult.credibilityScore,
        lastUpdated: researchResult.lastUpdated,
        authors: researchResult.authors,
        tags: researchResult.tags,
        imageUrl: researchResult.imageUrl || undefined
      }

      const citation = researchApiService.generateCitation(result as ResearchResult, format as any)
      citationText = citation.text
      bibliographyEntry = citation.bibEntry
    } else {
      // Manual citation creation
      citationText = claimText || 'Manual citation'
      bibliographyEntry = claimText || 'Manual citation'
    }

    // Create citation in database
    const citation = await prisma.citation.create({
      data: {
        bookId: book.id,
        researchResultId: researchResultId || null,
        chapterId: chapterId || null,
        claimText: claimText,
        format: format.toUpperCase() as any,
        citationText: citationText,
        bibliographyEntry: bibliographyEntry,
        pageNumber: pageNumber,
        inlineLocation: inlineLocation,
        notes: notes
      },
      include: {
        researchResult: {
          select: {
            title: true,
            sourceType: true,
            credibilityScore: true
          }
        },
        chapter: {
          select: {
            title: true,
            orderIndex: true
          }
        }
      }
    })

    console.log(`📝 Created ${format.toUpperCase()} citation for "${book.title}"`)

    return NextResponse.json({
      success: true,
      citation: citation,
      message: `Citation created in ${format.toUpperCase()} format`
    })

  } catch (error) {
    console.error('Create citation error:', error)
    return NextResponse.json({ 
      error: 'Failed to create citation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get citations for a book
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
    const format = searchParams.get('format') // Filter by citation format
    const chapterId = searchParams.get('chapterId')
    const bibliography = searchParams.get('bibliography') === 'true'

    // Verify book ownership
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

    // Build query conditions
    const whereConditions: any = { bookId }
    if (format && ['APA', 'MLA', 'CHICAGO'].includes(format.toUpperCase())) {
      whereConditions.format = format.toUpperCase()
    }
    if (chapterId) {
      whereConditions.chapterId = chapterId
    }

    if (bibliography) {
      // Return formatted bibliography
      const citations = await prisma.citation.findMany({
        where: whereConditions,
        orderBy: [
          { format: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          researchResult: {
            select: {
              title: true,
              sourceType: true,
              authors: true
            }
          }
        }
      })

      // Group by format
      const bibliography = {
        apa: citations.filter(c => c.format === 'APA').map(c => c.bibliographyEntry),
        mla: citations.filter(c => c.format === 'MLA').map(c => c.bibliographyEntry),
        chicago: citations.filter(c => c.format === 'CHICAGO').map(c => c.bibliographyEntry)
      }

      // Get preferred formats based on genre
      const preferredFormats = getPreferredCitationFormats(book.genre || '')

      return NextResponse.json({
        success: true,
        bookTitle: book.title,
        genre: book.genre,
        preferredFormats: preferredFormats,
        bibliography: bibliography,
        totalCitations: citations.length
      })
    } else {
      // Return detailed citation list
      const citations = await prisma.citation.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        include: {
          researchResult: {
            select: {
              id: true,
              title: true,
              sourceType: true,
              credibilityScore: true,
              sourceUrl: true
            }
          },
          chapter: {
            select: {
              id: true,
              title: true,
              orderIndex: true
            }
          }
        }
      })

      // Get citation statistics
      const formatCounts = await prisma.citation.groupBy({
        by: ['format'],
        where: { bookId },
        _count: { format: true }
      })

      const stats = {
        total: citations.length,
        byFormat: {
          apa: formatCounts.find(f => f.format === 'APA')?._count.format || 0,
          mla: formatCounts.find(f => f.format === 'MLA')?._count.format || 0,
          chicago: formatCounts.find(f => f.format === 'CHICAGO')?._count.format || 0
        }
      }

      return NextResponse.json({
        success: true,
        citations: citations,
        stats: stats,
        preferredFormats: getPreferredCitationFormats(book.genre || '')
      })
    }

  } catch (error) {
    console.error('Get citations error:', error)
    return NextResponse.json({ 
      error: 'Failed to get citations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Update a citation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { 
      citationId, 
      claimText, 
      format, 
      pageNumber, 
      inlineLocation, 
      notes 
    } = await request.json()

    if (!citationId) {
      return NextResponse.json({ error: 'Citation ID is required' }, { status: 400 })
    }

    // Verify book ownership and citation exists
    const existingCitation = await prisma.citation.findFirst({
      where: {
        id: citationId,
        bookId: bookId,
        book: {
          userId: session.user.id
        }
      }
    })

    if (!existingCitation) {
      return NextResponse.json({ error: 'Citation not found' }, { status: 404 })
    }

    // Update citation
    const updatedCitation = await prisma.citation.update({
      where: { id: citationId },
      data: {
        ...(claimText !== undefined && { claimText }),
        ...(format !== undefined && { format: format.toUpperCase() }),
        ...(pageNumber !== undefined && { pageNumber }),
        ...(inlineLocation !== undefined && { inlineLocation }),
        ...(notes !== undefined && { notes })
      },
      include: {
        researchResult: {
          select: {
            title: true,
            sourceType: true
          }
        },
        chapter: {
          select: {
            title: true,
            orderIndex: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      citation: updatedCitation,
      message: 'Citation updated successfully'
    })

  } catch (error) {
    console.error('Update citation error:', error)
    return NextResponse.json({ 
      error: 'Failed to update citation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Delete a citation
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
    const citationId = searchParams.get('citationId')

    if (!citationId) {
      return NextResponse.json({ error: 'Citation ID is required' }, { status: 400 })
    }

    // Verify book ownership and citation exists
    const existingCitation = await prisma.citation.findFirst({
      where: {
        id: citationId,
        bookId: bookId,
        book: {
          userId: session.user.id
        }
      }
    })

    if (!existingCitation) {
      return NextResponse.json({ error: 'Citation not found' }, { status: 404 })
    }

    // Delete citation
    await prisma.citation.delete({
      where: { id: citationId }
    })

    return NextResponse.json({
      success: true,
      message: 'Citation deleted successfully'
    })

  } catch (error) {
    console.error('Delete citation error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete citation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

