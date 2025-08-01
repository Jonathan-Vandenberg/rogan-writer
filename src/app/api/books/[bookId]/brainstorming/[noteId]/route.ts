import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BrainstormingService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string; noteId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all notes and find the specific one (includes ownership validation via bookId)
    const notes = await BrainstormingService.getNotesByBookId(params.bookId)
    const note = notes.find(n => n.id === params.noteId)
    
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
  { params }: { params: { bookId: string; noteId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify note belongs to this book first
    const notes = await BrainstormingService.getNotesByBookId(params.bookId)
    const existingNote = notes.find(n => n.id === params.noteId)
    
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

    const updatedNote = await BrainstormingService.updateNote(params.noteId, updateData)
    
    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error('Error updating brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { bookId: string; noteId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify note belongs to this book first
    const notes = await BrainstormingService.getNotesByBookId(params.bookId)
    const existingNote = notes.find(n => n.id === params.noteId)
    
    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await BrainstormingService.deleteNote(params.noteId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 