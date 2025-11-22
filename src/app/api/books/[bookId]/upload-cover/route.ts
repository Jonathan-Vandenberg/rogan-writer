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

    const resolvedParams = await params
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' }, 
        { status: 400 }
      )
    }

    // Validate file type
    const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' }, 
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' }, 
        { status: 400 }
      )
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: resolvedParams.bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'png'
    const fileName = `cover_${resolvedParams.bookId}_${timestamp}.${extension}`

    // Upload to S3
    const result = await s3Service.uploadCoverImage({
      imageBuffer: buffer,
      bookId: resolvedParams.bookId,
      fileName,
      contentType: file.type,
    })

    // Update book with cover image URL
    const updatedBook = await prisma.book.update({
      where: { id: resolvedParams.bookId },
      data: {
        coverImageUrl: result.url,
      },
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
      },
    })

    return NextResponse.json({
      success: true,
      book: updatedBook,
      url: result.url,
      s3Key: result.s3Key,
    })
  } catch (error) {
    console.error('Error uploading cover image:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

