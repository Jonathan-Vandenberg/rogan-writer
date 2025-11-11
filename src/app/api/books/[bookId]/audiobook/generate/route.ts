import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { s3Service } from '@/services/s3.service'

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
    const body = await request.json().catch(() => ({}))
    const { regenerateAll = false } = body

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Get chapters based on regenerateAll flag
    const chapters = await prisma.chapter.findMany({
      where: {
        bookId,
        content: {
          not: '',
        },
        ...(regenerateAll ? {} : {
          audioStatus: {
            in: ['not_generated', 'failed'],
          },
        }),
      },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        audioStatus: true,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    })

    if (chapters.length === 0) {
      return NextResponse.json({ 
        message: 'No chapters need audio generation',
        chaptersToGenerate: 0,
      })
    }

    console.log(`🎙️  Starting ${regenerateAll ? 'regeneration' : 'generation'} for ${chapters.length} chapters in book: ${book.title}`)

    // Delete the complete audiobook file if it exists (chapters are being regenerated)
    const completeAudiobookKey = `audiobooks/${bookId}/complete.mp3`
    try {
      await s3Service.deleteAudio(completeAudiobookKey)
      console.log(`🗑️  Deleted existing complete audiobook - will be regenerated on next download`)
    } catch (error) {
      // File might not exist, that's okay
      console.log(`ℹ️  No existing complete audiobook to delete`)
    }

    // Trigger audio generation for each chapter asynchronously
    // Note: This doesn't wait for completion - it just starts the process
    const generationPromises = chapters.map(chapter => {
      return fetch(`${request.nextUrl.origin}/api/books/${bookId}/chapters/${chapter.id}/audio`, {
        method: 'POST',
        headers: {
          'Cookie': request.headers.get('cookie') || '',
        },
      }).catch(error => {
        console.error(`Failed to start generation for chapter ${chapter.id}:`, error)
        return null
      })
    })

    // Wait for all requests to be initiated (but not completed)
    await Promise.all(generationPromises)

    return NextResponse.json({
      success: true,
      message: `Audio generation started for ${chapters.length} chapters`,
      chaptersToGenerate: chapters.length,
      chapters: chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        orderIndex: ch.orderIndex,
      })),
    })

  } catch (error) {
    console.error('Error starting batch audio generation:', error)
    return NextResponse.json({ 
      error: 'Failed to start batch audio generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check batch audio generation status
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

    const chapters = await prisma.chapter.findMany({
      where: {
        bookId,
        book: {
          userId: session.user.id,
        },
        content: {
          not: '',
        },
      },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        audioStatus: true,
        audioDuration: true,
        audioGenerated: true,
        audioError: true,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    })

    const statusCounts = {
      not_generated: 0,
      generating: 0,
      completed: 0,
      failed: 0,
    }

    chapters.forEach(chapter => {
      const status = chapter.audioStatus as keyof typeof statusCounts
      if (status in statusCounts) {
        statusCounts[status]++
      }
    })

    const totalDuration = chapters
      .filter(ch => ch.audioDuration)
      .reduce((sum, ch) => sum + (ch.audioDuration || 0), 0)

    return NextResponse.json({
      success: true,
      summary: {
        total: chapters.length,
        ...statusCounts,
        totalDurationSeconds: totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
      },
      chapters: chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        orderIndex: ch.orderIndex,
        audioStatus: ch.audioStatus,
        audioDuration: ch.audioDuration,
        audioGenerated: ch.audioGenerated,
        audioError: ch.audioError,
      })),
    })

  } catch (error) {
    console.error('Error fetching batch audio status:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch audio status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}

