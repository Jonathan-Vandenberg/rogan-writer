import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const timelineEvents = await prisma.timelineEvent.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
      include: {
        character: true,
        location: true,
      },
    });

    return NextResponse.json(timelineEvents);
  } catch (error) {
    console.error('Error fetching timeline events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.title) {
      return NextResponse.json({ error: 'Timeline event title is required' }, { status: 400 });
    }

    // Get next order index
    const maxOrderIndex = await prisma.timelineEvent.findFirst({
      where: { bookId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });

    const nextOrderIndex = (maxOrderIndex?.orderIndex || 0) + 1;

    // Create timeline event
    const timelineEvent = await prisma.timelineEvent.create({
      data: {
        bookId,
        title: data.title,
        description: data.description || null,
        eventDate: data.eventDate || null,
        startTime: data.startTime || nextOrderIndex,
        endTime: data.endTime || nextOrderIndex,
        orderIndex: nextOrderIndex,
        characterId: data.characterId || null,
        locationId: data.locationId || null,
      },
    });

    return NextResponse.json(timelineEvent, { status: 201 });
  } catch (error) {
    console.error('Error creating timeline event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}