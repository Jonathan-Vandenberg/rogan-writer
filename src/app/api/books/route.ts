import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookService } from '@/services'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const books = await BookService.getBooksByUserId(session.user.id)
    
    return NextResponse.json(books)
  } catch (error) {
    console.error('Error fetching books:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, genre, targetWords } = body

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Create the book
    const book = await BookService.createBook({
      title: title.trim(),
      description: description?.trim() || undefined,
      genre: genre?.trim() || undefined,
      targetWords: targetWords ? parseInt(targetWords) : undefined,
      userId: session.user.id
    })

    return NextResponse.json(book)
  } catch (error) {
    console.error('Error creating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 