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
  const resolvedParams = await params
  const data = await request.json()
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const plotPoint = await PlotService.createPlotPoint({
      type: data.type,
      title: data.title,
      description: data.description,
      orderIndex: data.orderIndex || 0,
      subplot: data.subplot,
      bookId: resolvedParams.bookId,
      chapterId: data.chapterId
    })

    // 🚀 AUTO-UPDATE UNIFIED VECTOR STORE for new plot point
    try {
      const { unifiedEmbeddingService } = await import('@/services/unified-embedding.service')
      const content = `${plotPoint.title}\n\n${plotPoint.description || ''}`
      await unifiedEmbeddingService.updateSourceEmbeddings({
        bookId: resolvedParams.bookId,
        sourceType: 'plotPoint',
        sourceId: plotPoint.id,
        content,
        metadata: {
          title: plotPoint.title,
          type: plotPoint.type,
          subplot: plotPoint.subplot,
          orderIndex: plotPoint.orderIndex,
        }
      })
      console.log(`✅ Updated unified vector store for plot point: ${plotPoint.id}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to update vector store for plot point ${plotPoint.id}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }
    
    return NextResponse.json(plotPoint, { status: 201 })
  } catch (error: any) {
    console.error('Error creating plot point:', error)
    
    // Handle unique constraint violation (duplicate plot point)
    if (error?.code === 'P2002' && error?.meta?.target?.includes('bookId')) {
      return NextResponse.json({ 
        error: `A plot point of type "${data.type}" already exists for the "${data.subplot}" subplot. Each subplot can only have one plot point per type.` 
      }, { status: 409 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 