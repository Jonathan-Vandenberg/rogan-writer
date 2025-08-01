import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const book = await BookService.getBookById(params.bookId)
    
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }
    
    return NextResponse.json(book)
  } catch (error) {
    console.error('Error fetching book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const book = await BookService.updateBook(params.bookId, {
      title: data.title,
      description: data.description,
      genre: data.genre,
      targetWords: data.targetWords,
      status: data.status,
      pageWidth: data.pageWidth,
      pageHeight: data.pageHeight,
      fontSize: data.fontSize,
      fontFamily: data.fontFamily,
      lineHeight: data.lineHeight,
      marginTop: data.marginTop,
      marginBottom: data.marginBottom,
      marginLeft: data.marginLeft,
      marginRight: data.marginRight,
      coverImageUrl: data.coverImageUrl
    })
    
    return NextResponse.json(book)
  } catch (error) {
    console.error('Error updating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await BookService.deleteBook(params.bookId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 