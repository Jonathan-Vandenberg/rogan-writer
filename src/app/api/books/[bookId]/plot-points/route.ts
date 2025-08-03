import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PlotService } from '@/services'

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
    const plotPoints = await PlotService.getPlotPointsByBookId(resolvedParams.bookId)
    
    return NextResponse.json(plotPoints)
  } catch (error) {
    console.error('Error fetching plot points:', error)
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
    
    const plotPoint = await PlotService.createPlotPoint({
      type: data.type,
      title: data.title,
      description: data.description,
      orderIndex: data.orderIndex || 0,
      subplot: data.subplot,
      bookId: resolvedParams.bookId,
      chapterId: data.chapterId
    })
    
    return NextResponse.json(plotPoint, { status: 201 })
  } catch (error) {
    console.error('Error creating plot point:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 