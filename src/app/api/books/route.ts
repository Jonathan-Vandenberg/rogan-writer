import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookService } from '@/services'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user exists in database (for JWT + PrismaAdapter compatibility)
    await BookService.ensureUserExists({
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name || undefined,
      image: session.user.image || undefined
    })

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

    // Ensure user exists in database (for JWT + PrismaAdapter compatibility)
    await BookService.ensureUserExists({
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name || undefined,
      image: session.user.image || undefined
    })

    // Create the book with default typography settings
    const book = await BookService.createBook({
      title: title.trim(),
      description: description?.trim() || undefined,
      genre: genre?.trim() || undefined,
      targetWords: targetWords ? parseInt(targetWords) : undefined,
      userId: session.user.id,
      // Default typography settings
      pageWidth: 6.0,
      pageHeight: 9.0,
      fontSize: 16,
      fontFamily: "Verdana",
      lineHeight: 1.5,
      marginTop: 0.7,
      marginBottom: 0.7,
      marginLeft: 0.7,
      marginRight: 0.7
    })

    return NextResponse.json(book)
  } catch (error) {
    console.error('Error creating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 