import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SceneCardService } from '@/services'

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
    const sceneCards = await SceneCardService.getSceneCardsByBookId(resolvedParams.bookId)
    
    return NextResponse.json(sceneCards)
  } catch (error) {
    console.error('Error fetching scene cards:', error)
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
    
    const sceneCard = await SceneCardService.createSceneCard({
      title: data.title,
      description: data.description,
      purpose: data.purpose,
      conflict: data.conflict,
      outcome: data.outcome,
      bookId: resolvedParams.bookId,
      chapterId: data.chapterId
    })
    
    return NextResponse.json(sceneCard, { status: 201 })
  } catch (error) {
    console.error('Error creating scene card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 