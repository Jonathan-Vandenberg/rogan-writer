import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { imageGenerationService } from '@/services/image-generation.service'

/**
 * POST /api/books/[bookId]/generate-cover
 * Generate cover art for a book
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
    const body = await request.json().catch(() => ({}))
    const customPrompt = body.prompt || null // Optional custom prompt

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        genre: true,
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Check if user has image generation model configured and get user's name
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        openRouterApiKey: true,
        openRouterImageModel: true,
        name: true, // Get user's name for author attribution
      },
    })

    if (!user?.openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Please configure it in settings.' },
        { status: 400 }
      )
    }

    // Generate cover art
    const result = await imageGenerationService.generateCoverArt({
      bookId: book.id,
      userId: session.user.id,
      title: book.title,
      description: book.description,
      genre: book.genre,
      authorName: user.name || null, // Pass author name to image generation
      customPrompt: customPrompt, // Use custom prompt if provided
    })

    // Update book with cover image URL
    const updatedBook = await prisma.book.update({
      where: { id: bookId },
      data: {
        coverImageUrl: result.imageUrl,
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
      prompt: result.prompt,
      model: result.model,
    })
  } catch (error) {
    console.error('Error generating cover art:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate cover art',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

