import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PlotService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; plotPointId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Get all plot points and find the specific one (includes ownership validation via bookId)
    const plotPoints = await PlotService.getPlotPointsByBookId(resolvedParams.bookId)
    const plotPoint = plotPoints.find(p => p.id === resolvedParams.plotPointId)
    
    if (!plotPoint) {
      return NextResponse.json({ error: 'Plot point not found' }, { status: 404 })
    }
    
    return NextResponse.json(plotPoint)
  } catch (error) {
    console.error('Error fetching plot point:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookId: string; plotPointId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify plot point belongs to this book first
    const plotPoints = await PlotService.getPlotPointsByBookId(resolvedParams.bookId)
    const existingPlotPoint = plotPoints.find(p => p.id === resolvedParams.plotPointId)
    
    if (!existingPlotPoint) {
      return NextResponse.json({ error: 'Plot point not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, completed, orderIndex, chapterId } = body

    const updateData: { title?: string; description?: string; completed?: boolean; orderIndex?: number; chapterId?: string } = {}
    
    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = title.trim()
    }
    
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }
    
    if (completed !== undefined) {
      updateData.completed = completed
    }

    if (orderIndex !== undefined) {
      updateData.orderIndex = orderIndex
    }

    if (chapterId !== undefined) {
      updateData.chapterId = chapterId || null
    }

    const updatedPlotPoint = await PlotService.updatePlotPoint(resolvedParams.plotPointId, updateData)
    
    return NextResponse.json(updatedPlotPoint)
  } catch (error) {
    console.error('Error updating plot point:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; plotPointId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify plot point belongs to this book first
    const plotPoints = await PlotService.getPlotPointsByBookId(resolvedParams.bookId)
    const existingPlotPoint = plotPoints.find(p => p.id === resolvedParams.plotPointId)
    
    if (!existingPlotPoint) {
      return NextResponse.json({ error: 'Plot point not found' }, { status: 404 })
    }

    // Add delete method to PlotService if it doesn't exist
    await PlotService.deletePlotPoint(resolvedParams.plotPointId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting plot point:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 