import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ChapterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chapters = await ChapterService.getChaptersByBookId(params.bookId)
    
    return NextResponse.json(chapters)
  } catch (error) {
    console.error('Error fetching chapters:', error)
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

    const data = await request.json()
    
    const chapter = await ChapterService.createChapter({
      title: data.title,
      description: data.description,
      bookId: params.bookId
    })
    
    return NextResponse.json(chapter, { status: 201 })
  } catch (error) {
    console.error('Error creating chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 