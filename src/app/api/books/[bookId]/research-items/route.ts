import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ResearchItemService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const researchItems = await ResearchItemService.getResearchItemsByBookId(resolvedParams.bookId)
    
    return NextResponse.json(researchItems)
  } catch (error) {
    console.error('Error fetching research items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
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
    
    const researchItem = await ResearchItemService.createResearchItem({
      title: data.title,
      content: data.content,
      url: data.url,
      imageUrl: data.imageUrl,
      tags: data.tags,
      itemType: data.itemType,
      bookId: resolvedParams.bookId
    })
    
    return NextResponse.json(researchItem, { status: 201 })
  } catch (error) {
    console.error('Error creating research item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 