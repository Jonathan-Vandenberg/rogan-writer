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

    // Check if complete audiobook already exists in S3
    const completeAudiobookKey = `audiobooks/${bookId}/complete.mp3`
    
    // Use book title as filename (sanitized)
    const sanitizedTitle = book.title.replace(/[^a-z0-9\s\-_]/gi, '').replace(/\s+/g, '_')
    const fileName = `${sanitizedTitle}.mp3`
    
    try {
      console.log(`🔍 Checking for existing complete audiobook in S3...`)
      // Check if file exists using HeadObject (fast check without downloading)
      const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'ap-southeast-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      })
      
      // Check if file exists (this is fast - doesn't download the file)
      await s3Client.send(new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'student-ai',
        Key: completeAudiobookKey,
      }))
      
      console.log(`✅ Found existing complete audiobook in S3`)
      
      // Generate signed URL for direct download from S3 (much faster!)
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'student-ai',
        Key: completeAudiobookKey,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
        ResponseContentType: 'audio/mpeg',
      })
      
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      console.log(`🔗 Generated signed URL for direct download`)
      
      // Return signed URL in JSON for frontend to handle
      return NextResponse.json({ 
        downloadUrl: signedUrl,
        fileName: fileName,
        cached: true
      })
      
    } catch (error) {
      // Complete audiobook doesn't exist, need to create it
      console.log(`📥 No complete audiobook found. Downloading and concatenating ${book.chapters.length} audio chapters...`)
    }

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
    
    // Upload complete audiobook to S3 for future downloads
    try {
      console.log(`📤 Uploading complete audiobook to S3...`)
      // Upload directly with the full S3 key
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'ap-southeast-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      })
      
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'student-ai',
        Key: completeAudiobookKey,
        Body: concatenatedAudio,
        ContentType: 'audio/mpeg',
      }))
      
      console.log(`✅ Complete audiobook saved to S3: ${completeAudiobookKey}`)
      
      // Create export record for tracking
      try {
        await prisma.export.create({
          data: {
            userId: session.user.id,
            bookId: book.id,
            format: 'MP3',
            fileName: fileName,
            status: 'COMPLETED',
            fileUrl: null,
          }
        })
        console.log(`📝 Export record created for audiobook: ${fileName}`)
      } catch (error) {
        console.error('Failed to create export record:', error)
      }
      
      // Generate signed URL and redirect to S3 for fast download
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'student-ai',
        Key: completeAudiobookKey,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
        ResponseContentType: 'audio/mpeg',
      })
      
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      console.log(`🔗 Generated signed URL for direct download`)
      
      // Return signed URL in JSON for frontend to handle
      return NextResponse.json({ 
        downloadUrl: signedUrl,
        fileName: fileName,
        cached: false
      })
      
    } catch (uploadError) {
      console.error('Failed to upload complete audiobook to S3:', uploadError)
      
      // Fallback: Stream through server if S3 upload fails
      console.log(`⚠️ Falling back to direct streaming...`)
      
      // Create export record
      try {
        await prisma.export.create({
          data: {
            userId: session.user.id,
            bookId: book.id,
            format: 'MP3',
            fileName: fileName,
            status: 'COMPLETED',
            fileUrl: null,
          }
        })
      } catch (error) {
        console.error('Failed to create export record:', error)
      }
      
      // Return the concatenated audio file directly
      return new NextResponse(concatenatedAudio as unknown as BodyInit, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': concatenatedAudio.length.toString(),
        },
      })
    }

  } catch (error) {
    console.error('Error downloading audiobook:', error)
    return NextResponse.json({ 
      error: 'Failed to download audiobook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


