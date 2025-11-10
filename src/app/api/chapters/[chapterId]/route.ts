import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ChapterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const chapter = await ChapterService.getChapterById(resolvedParams.chapterId)
    
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    
    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error fetching chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const data = await request.json()
    
    // Handle content updates specifically
    if (data.content !== undefined) {
      const chapter = await ChapterService.updateChapterContent(resolvedParams.chapterId, data.content)
      
      // 🚀 AUTO-REGENERATE EMBEDDING for updated chapter content
      try {
        const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
        await aiEmbeddingService.updateChapterEmbedding(resolvedParams.chapterId)
        console.log(`✅ Updated embedding for chapter: ${resolvedParams.chapterId}`)
      } catch (embeddingError) {
        console.error(`⚠️ Failed to update embedding for chapter ${resolvedParams.chapterId}:`, embeddingError)
        // Don't fail the request if embedding generation fails
      }
      
      return NextResponse.json(chapter)
    }
    
    // Handle other field updates
    const chapter = await ChapterService.updateChapter(resolvedParams.chapterId, {
      title: data.title,
      description: data.description,
      orderIndex: data.orderIndex
    })
    
    // 🚀 AUTO-REGENERATE EMBEDDING if title or description changed (part of embedding content)
    if (data.title !== undefined || data.description !== undefined) {
      try {
        const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
        await aiEmbeddingService.updateChapterEmbedding(resolvedParams.chapterId)
        console.log(`✅ Updated embedding for chapter: ${resolvedParams.chapterId} (title/description change)`)
      } catch (embeddingError) {
        console.error(`⚠️ Failed to update embedding for chapter ${resolvedParams.chapterId}:`, embeddingError)
        // Don't fail the request if embedding generation fails
      }
    }
    
    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error updating chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    await ChapterService.deleteChapter(resolvedParams.chapterId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 