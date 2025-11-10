import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BrainstormingService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const url = new URL(request.url)
    const query = url.searchParams.get('search')

    let notes
    if (query) {
      notes = await BrainstormingService.searchNotes(resolvedParams.bookId, query)
    } else {
      notes = await BrainstormingService.getNotesByBookId(resolvedParams.bookId)
    }
    
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching brainstorming notes:', error)
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

    const resolvedParams = await params
    const body = await request.json()
    const { title, content, tags } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'Title and content are required' }, 
        { status: 400 }
      )
    }

    const note = await BrainstormingService.createNote({
      title: title.trim(),
      content: content.trim(),
      tags: tags || [],
      bookId: resolvedParams.bookId
    })

    // 🚀 AUTO-GENERATE EMBEDDING for new brainstorming note
    try {
      const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
      await aiEmbeddingService.updateBrainstormingEmbeddingById(note.id)
      console.log(`✅ Generated embedding for brainstorming note: ${note.id}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to generate embedding for brainstorming note ${note.id}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }
    
    return NextResponse.json(note)
  } catch (error) {
    console.error('Error creating brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 