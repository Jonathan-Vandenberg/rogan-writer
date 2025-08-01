import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { WritingSessionService } from '@/services'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const writingSessions = await WritingSessionService.getSessionsByUserId(session.user.id)
    
    return NextResponse.json(writingSessions)
  } catch (error) {
    console.error('Error fetching writing sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const writingSession = await WritingSessionService.createSession({
      targetWords: data.targetWords,
      notes: data.notes,
      userId: session.user.id,
      bookId: data.bookId
    })
    
    return NextResponse.json(writingSession, { status: 201 })
  } catch (error) {
    console.error('Error creating writing session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 