import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ChapterService } from '@/services'

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
    const chapters = await ChapterService.getChaptersByBookId(bookId)
    
    return NextResponse.json(chapters)
  } catch (error) {
    console.error('Error fetching chapters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const data = await request.json()
    
    const chapter = await ChapterService.createChapter({
      title: data.title,
      description: data.description,
      bookId: bookId
    })

    // 🚀 AUTO-GENERATE EMBEDDING for new chapter
    try {
      const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
      await aiEmbeddingService.updateChapterEmbedding(chapter.id)
      console.log(`✅ Generated embedding for chapter: ${chapter.id}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to generate embedding for chapter ${chapter.id}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }
    
    return NextResponse.json(chapter, { status: 201 })
  } catch (error) {
    console.error('Error creating chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 