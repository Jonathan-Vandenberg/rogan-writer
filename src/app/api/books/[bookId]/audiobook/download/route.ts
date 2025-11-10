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

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      include: {
        chapters: {
          where: {
            audioStatus: 'completed',
            audioS3Key: {
              not: null
            }
          },
          orderBy: {
            orderIndex: 'asc'
          },
          select: {
            id: true,
            title: true,
            orderIndex: true,
            audioS3Key: true,
          }
        }
      }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (book.chapters.length === 0) {
      return NextResponse.json({ 
        error: 'No audio chapters available. Please generate audiobook first.' 
      }, { status: 400 })
    }

    console.log(`📥 Downloading and concatenating ${book.chapters.length} audio chapters...`)

    // Download all audio files from S3
    const audioBuffers: Buffer[] = []
    
    for (const chapter of book.chapters) {
      if (!chapter.audioS3Key) continue
      
      try {
        const audioBuffer = await s3Service.getAudioBuffer(chapter.audioS3Key)
        audioBuffers.push(audioBuffer)
        console.log(`✓ Downloaded chapter ${chapter.orderIndex + 1}: ${chapter.title}`)
      } catch (error) {
        console.error(`✗ Failed to download chapter ${chapter.orderIndex + 1}:`, error)
      }
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to download audio files' 
      }, { status: 500 })
    }

    // Concatenate all MP3 buffers
    console.log(`🔗 Concatenating ${audioBuffers.length} audio files...`)
    const concatenatedAudio = Buffer.concat(audioBuffers)

    console.log(`✅ Complete audiobook ready: ${(concatenatedAudio.length / 1024 / 1024).toFixed(2)} MB`)

    // Return the concatenated audio file
    return new NextResponse(concatenatedAudio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${book.title.replace(/[^a-z0-9]/gi, '_')}_audiobook.mp3"`,
        'Content-Length': concatenatedAudio.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error downloading audiobook:', error)
    return NextResponse.json({ 
      error: 'Failed to download audiobook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


