import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ChapterService, PageService, BookService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In the new system, pages are calculated dynamically from chapter content
    const chapter = await ChapterService.getChapterById(params.chapterId)
    
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Get book data for typography settings
    const book = await BookService.getBookById(chapter.bookId)
    
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Calculate pagination based on the chapter content and book typography
    const typography = {
      fontSize: book.fontSize || 12,
      lineHeight: book.lineHeight || 1.5,
      pageWidth: book.pageWidth || 6,
      pageHeight: book.pageHeight || 9,
      marginTop: book.marginTop || 1,
      marginBottom: book.marginBottom || 1,
      marginLeft: book.marginLeft || 1,
      marginRight: book.marginRight || 1,
    }

    const pages = PageService.calculatePaginationForChapter(chapter.content, typography)
    
    return NextResponse.json(pages)
  } catch (error) {
    console.error('Error fetching pages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In the new system, we don't really "create" individual pages
    // Pages are calculated dynamically from chapter content
    // This endpoint is mainly for backward compatibility
    
    const data = await request.json()
    
    if (data.content) {
      // If content is provided, append it to the chapter
      const chapter = await ChapterService.getChapterById(params.chapterId)
      if (!chapter) {
        return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
      }

      const updatedContent = chapter.content + (chapter.content ? '\n\n' : '') + data.content
      await ChapterService.updateChapterContent(params.chapterId, updatedContent)
      
      return NextResponse.json({ 
        message: 'Content added to chapter',
        content: data.content
      }, { status: 201 })
    }
    
    // Create a metadata page entry (though this isn't really needed in the new system)
    const page = await PageService.createPage({
      chapterId: params.chapterId
    })
    
    return NextResponse.json(page, { status: 201 })
  } catch (error) {
    console.error('Error creating page:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 