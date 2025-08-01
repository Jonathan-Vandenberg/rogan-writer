import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PageService, ChapterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pageStats = await PageService.getPageStats(params.pageId)
    
    if (!pageStats) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }
    
    return NextResponse.json(pageStats)
  } catch (error) {
    console.error('Error fetching page:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    // In the new system, we update the chapter content instead of individual pages
    // This route is mainly for backward compatibility or metadata updates
    if (data.content) {
      // Get the page to find which chapter it belongs to
      const page = await PageService.getPageById(params.pageId)
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 })
      }

      // Update the specific section of the chapter content
      const chapter = await ChapterService.getChapterById(page.chapterId)
      if (!chapter) {
        return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
      }

      // Update chapter content with the new page content
      const updatedChapterContent = 
        chapter.content.substring(0, page.startPosition) + 
        data.content + 
        chapter.content.substring(page.endPosition)

      await ChapterService.updateChapterContent(page.chapterId, updatedChapterContent)
      
      return NextResponse.json({ 
        message: 'Page content updated',
        content: data.content,
        wordCount: data.content.trim().split(/\s+/).length
      })
    }
    
    // For other metadata updates
    const page = await PageService.updatePage(params.pageId, {
      startPosition: data.startPosition,
      endPosition: data.endPosition,
      wordCount: data.wordCount
    })
    
    return NextResponse.json(page)
  } catch (error) {
    console.error('Error updating page:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await PageService.deletePage(params.pageId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting page:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 