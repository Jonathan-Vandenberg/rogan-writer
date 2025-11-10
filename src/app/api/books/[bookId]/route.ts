import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookService } from '@/services'

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
    
    // Get the book with stats
    const book = await BookService.getBookStats(bookId)
    
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }
    
    // Verify ownership
    if (book.userId !== session.user.id) {
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
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const data = await request.json()
    
    const book = await BookService.updateBook(resolvedParams.bookId, {
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
      coverImageUrl: data.coverImageUrl,
      chapterTitleFontFamily: data.chapterTitleFontFamily,
      chapterTitleFontSize: data.chapterTitleFontSize,
      chapterTitleAlignment: data.chapterTitleAlignment,
      chapterTitlePadding: data.chapterTitlePadding,
      showChapterTitle: data.showChapterTitle
    })
    
    return NextResponse.json(book)
  } catch (error) {
    console.error('Error updating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    await BookService.deleteBook(resolvedParams.bookId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 