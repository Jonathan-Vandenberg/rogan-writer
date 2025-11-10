import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SceneStatus } from '@prisma/client';

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

    const sceneCards = await prisma.sceneCard.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
      include: {
        chapter: true,
      },
    });

    return NextResponse.json(sceneCards);
  } catch (error) {
    console.error('Error fetching scene cards:', error);
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
      return NextResponse.json({ error: 'Scene card title is required' }, { status: 400 });
    }

    // Get next order index
    const maxOrderIndex = await prisma.sceneCard.findFirst({
      where: { bookId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });

    const nextOrderIndex = (maxOrderIndex?.orderIndex || 0) + 1;

    // Create scene card
    const sceneCard = await prisma.sceneCard.create({
      data: {
        bookId,
        title: data.title,
        description: data.description || null,
        purpose: data.purpose || null,
        conflict: data.conflict || null,
        outcome: data.outcome || null,
        orderIndex: nextOrderIndex,
        wordCount: 0,
        status: SceneStatus.PLANNED,
        chapterId: data.chapterId || null,
      },
    });

    return NextResponse.json(sceneCard, { status: 201 });
  } catch (error) {
    console.error('Error creating scene card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}