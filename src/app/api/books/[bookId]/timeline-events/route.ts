import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { TimelineEventService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const timelineEvents = await TimelineEventService.getTimelineEventsByBookId(bookId)
    
    return NextResponse.json(timelineEvents)
  } catch (error) {
    console.error('Error fetching timeline events:', error)
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
    console.log('Received timeline event data:', data)
    
    // Validate required fields
    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    
    if (typeof data.startTime !== 'number' || data.startTime < 1) {
      return NextResponse.json({ error: 'Valid startTime is required (must be >= 1)' }, { status: 400 })
    }
    
    if (typeof data.endTime !== 'number' || data.endTime < 1) {
      return NextResponse.json({ error: 'Valid endTime is required (must be >= 1)' }, { status: 400 })
    }
    
    if (data.endTime < data.startTime) {
      return NextResponse.json({ error: 'endTime must be >= startTime' }, { status: 400 })
    }

    const timelineEvent = await TimelineEventService.createTimelineEvent({
      title: data.title.trim(),
      description: data.description?.trim() || null,
      eventDate: data.eventDate?.trim() || null,
      startTime: parseInt(data.startTime),
      endTime: parseInt(data.endTime),
      bookId: params.bookId,
      characterId: data.characterId || null,
      locationId: data.locationId || null
    })
    
    console.log('Created timeline event:', timelineEvent.id)
    return NextResponse.json(timelineEvent, { status: 201 })
  } catch (error) {
    console.error('Error creating timeline event:', error)
    console.error('Error details:', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code,
      meta: (error as any)?.meta
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error as any)?.message : undefined
    }, { status: 500 })
  }
} 