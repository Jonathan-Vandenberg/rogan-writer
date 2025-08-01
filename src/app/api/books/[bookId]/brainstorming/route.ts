import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BrainstormingService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const query = url.searchParams.get('search')

    let notes
    if (query) {
      notes = await BrainstormingService.searchNotes(params.bookId, query)
    } else {
      notes = await BrainstormingService.getNotesByBookId(params.bookId)
    }
    
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching brainstorming notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      bookId: params.bookId
    })
    
    return NextResponse.json(note)
  } catch (error) {
    console.error('Error creating brainstorming note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 