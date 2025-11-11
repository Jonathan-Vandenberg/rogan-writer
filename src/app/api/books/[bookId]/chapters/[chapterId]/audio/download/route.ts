import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId, chapterId } = await params

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
        book: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        title: true,
        audioS3Key: true,
        audioStatus: true,
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    if (!chapter.audioS3Key || chapter.audioStatus !== 'completed') {
      return NextResponse.json({ error: 'Audio not available for this chapter' }, { status: 400 })
    }

    // Generate signed URL with download disposition
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    })
    
    // Sanitize the chapter title for filename
    const sanitizedTitle = chapter.title.replace(/[^a-z0-9\s\-_]/gi, '').replace(/\s+/g, '_')
    const fileName = `${sanitizedTitle}.mp3`
    
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'student-ai',
      Key: chapter.audioS3Key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
      ResponseContentType: 'audio/mpeg',
    })
    
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    console.log(`🔗 Generated download URL for chapter: ${chapter.title}`)
    
    return NextResponse.json({
      downloadUrl,
      fileName,
    })

  } catch (error) {
    console.error('Error generating chapter download URL:', error)
    return NextResponse.json({ 
      error: 'Failed to generate download URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

