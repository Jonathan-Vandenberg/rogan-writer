import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BrainstormingService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; noteId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    
    // Get all notes and find the specific one (includes ownership validation via bookId)
    const notes = await BrainstormingService.getNotesByBookId(resolvedParams.bookId)
    const note = notes.find(n => n.id === resolvedParams.noteId)
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    
    return NextResponse.json(note)
  } catch (error) {
    console.error('Error fetching brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookId: string; noteId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify note belongs to this book first
    const notes = await BrainstormingService.getNotesByBookId(resolvedParams.bookId)
    const existingNote = notes.find(n => n.id === resolvedParams.noteId)
    
    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, content, tags } = body

    const updateData: { title?: string; content?: string; tags?: string[] } = {}
    
    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = title.trim()
    }
    
    if (content !== undefined) {
      if (!content.trim()) {
        return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
      }
      updateData.content = content.trim()
    }
    
    if (tags !== undefined) {
      updateData.tags = tags
    }

    const updatedNote = await BrainstormingService.updateNote(resolvedParams.noteId, updateData)
    
    // 🚀 AUTO-REGENERATE EMBEDDING if title or content changed
    if (updateData.title !== undefined || updateData.content !== undefined) {
      try {
        const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
        await aiEmbeddingService.updateBrainstormingEmbeddingById(resolvedParams.noteId)
        console.log(`✅ Updated embedding for brainstorming note: ${resolvedParams.noteId}`)
      } catch (embeddingError) {
        console.error(`⚠️ Failed to update embedding for brainstorming note ${resolvedParams.noteId}:`, embeddingError)
        // Don't fail the request if embedding generation fails
      }
    }
    
    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error('Error updating brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; noteId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify note belongs to this book first
    const notes = await BrainstormingService.getNotesByBookId(resolvedParams.bookId)
    const existingNote = notes.find(n => n.id === resolvedParams.noteId)
    
    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await BrainstormingService.deleteNote(resolvedParams.noteId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 