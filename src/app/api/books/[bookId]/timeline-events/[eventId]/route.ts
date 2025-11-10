import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { TimelineEventService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; eventId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Get all timeline events and find the specific one (includes ownership validation via bookId)
    const events = await TimelineEventService.getTimelineEventsByBookId(resolvedParams.bookId)
    const event = events.find(e => e.id === resolvedParams.eventId)
    
    if (!event) {
      return NextResponse.json({ error: 'Timeline event not found' }, { status: 404 })
    }
    
    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching timeline event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookId: string; eventId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify timeline event belongs to this book first
    const events = await TimelineEventService.getTimelineEventsByBookId(resolvedParams.bookId)
    const existingEvent = events.find(e => e.id === resolvedParams.eventId)
    
    if (!existingEvent) {
      return NextResponse.json({ error: 'Timeline event not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, eventDate, startTime, endTime, characterId, locationId, orderIndex } = body

    const updateData: { 
      title?: string
      description?: string
      eventDate?: string
      startTime?: number
      endTime?: number
      characterId?: string
      locationId?: string
      orderIndex?: number
    } = {}
    
    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = title.trim()
    }
    
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }
    
    if (eventDate !== undefined) {
      updateData.eventDate = eventDate?.trim() || null
    }

    if (startTime !== undefined) {
      updateData.startTime = startTime
    }

    if (endTime !== undefined) {
      updateData.endTime = endTime
    }

    if (characterId !== undefined) {
      updateData.characterId = characterId || null
    }

    if (locationId !== undefined) {
      updateData.locationId = locationId || null
    }

    if (orderIndex !== undefined) {
      updateData.orderIndex = orderIndex
    }

    const updatedEvent = await TimelineEventService.updateTimelineEvent(resolvedParams.eventId, updateData)
    
    // 🚀 AUTO-REGENERATE EMBEDDING if title or description changed
    if (updateData.title !== undefined || updateData.description !== undefined) {
      try {
        const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
        await aiEmbeddingService.updateTimelineEventEmbedding(resolvedParams.eventId)
        console.log(`✅ Updated embedding for timeline event: ${resolvedParams.eventId}`)
      } catch (embeddingError) {
        console.error(`⚠️ Failed to update embedding for timeline event ${resolvedParams.eventId}:`, embeddingError)
        // Don't fail the request if embedding generation fails
      }
    }
    
    return NextResponse.json(updatedEvent)
  } catch (error) {
    console.error('Error updating timeline event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; eventId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify timeline event belongs to this book first
    const events = await TimelineEventService.getTimelineEventsByBookId(resolvedParams.bookId)
    const existingEvent = events.find(e => e.id === resolvedParams.eventId)
    
    if (!existingEvent) {
      return NextResponse.json({ error: 'Timeline event not found' }, { status: 404 })
    }

    await TimelineEventService.deleteTimelineEvent(resolvedParams.eventId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting timeline event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 