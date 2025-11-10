import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CharacterRole } from '@prisma/client';

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

    const characters = await prisma.character.findMany({
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

    return NextResponse.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
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
      return NextResponse.json({ error: 'Character name is required' }, { status: 400 });
    }

    // Map role string to CharacterRole enum if provided
    let role: CharacterRole = CharacterRole.MINOR;
    if (data.role && Object.values(CharacterRole).includes(data.role as CharacterRole)) {
      role = data.role as CharacterRole;
    }

    // Create character
    const character = await prisma.character.create({
      data: {
        bookId,
        name: data.name,
        description: data.description || null,
        appearance: data.appearance || null,
        personality: data.personality || (data.traits ? data.traits.join(', ') : null),
        backstory: data.backstory || null,
        role: role,
        imageUrl: data.imageUrl || null,
      },
    });

    // 🚀 AUTO-GENERATE EMBEDDING for new character
    try {
      const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
      await aiEmbeddingService.updateCharacterEmbedding(character.id)
      console.log(`✅ Generated embedding for character: ${character.id}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to generate embedding for character ${character.id}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }

    return NextResponse.json(character, { status: 201 });
  } catch (error) {
    console.error('Error creating character:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}