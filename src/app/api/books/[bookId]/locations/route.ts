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

    const locations = await prisma.location.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            timelineEvents: true,
          },
        },
      },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
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
    if (!data.name) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 });
    }

    // Create location
    const location = await prisma.location.create({
      data: {
        bookId,
        name: data.name,
        description: data.description || null,
        geography: data.geography || null,
        culture: data.culture || null,
        rules: data.rules || null,
        imageUrl: data.imageUrl || null,
      },
    });

    // 🚀 AUTO-GENERATE EMBEDDING for new location
    try {
      const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
      await aiEmbeddingService.updateLocationEmbedding(location.id)
      console.log(`✅ Generated embedding for location: ${location.id}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to generate embedding for location ${location.id}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}