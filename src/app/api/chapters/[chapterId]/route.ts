import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ChapterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chapter = await ChapterService.getChapterById(params.chapterId)
    
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    
    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error fetching chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    // Handle content updates specifically
    if (data.content !== undefined) {
      const chapter = await ChapterService.updateChapterContent(params.chapterId, data.content)
      return NextResponse.json(chapter)
    }
    
    // Handle other field updates
    const chapter = await ChapterService.updateChapter(params.chapterId, {
      title: data.title,
      description: data.description,
      orderIndex: data.orderIndex
    })
    
    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error updating chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ChapterService.deleteChapter(params.chapterId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 