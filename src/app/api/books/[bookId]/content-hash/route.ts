import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

    // Fetch all content that could affect brainstorming suggestions
    const [chapters, characters, locations, plotPoints, timelineEvents, brainstormingNotes, sceneCards, research] = await Promise.all([
      prisma.chapter.findMany({
        where: { bookId },
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.character.findMany({
        where: { bookId },
        select: { id: true, name: true, description: true, updatedAt: true }
      }),
      prisma.location.findMany({
        where: { bookId },
        select: { id: true, name: true, description: true, updatedAt: true }
      }),
      prisma.plotPoint.findMany({
        where: { bookId },
        select: { id: true, title: true, description: true, updatedAt: true }
      }),
      prisma.timelineEvent.findMany({
        where: { bookId },
        select: { id: true, title: true, description: true, updatedAt: true }
      }),
      prisma.brainstormingNote.findMany({
        where: { bookId },
        select: { id: true, title: true, content: true, updatedAt: true }
      }),
      prisma.sceneCard.findMany({
        where: { bookId },
        select: { id: true, title: true, description: true, updatedAt: true }
      }),
      prisma.researchItem.findMany({
        where: { bookId },
        select: { id: true, title: true, content: true, updatedAt: true }
      })
    ]);

    // Create a hash from all updatedAt timestamps and counts
    const hashData = {
      chaptersCount: chapters.length,
      chaptersUpdated: chapters.map(c => c.updatedAt.getTime()).join(','),
      charactersCount: characters.length,
      charactersUpdated: characters.map(c => c.updatedAt.getTime()).join(','),
      locationsCount: locations.length,
      locationsUpdated: locations.map(l => l.updatedAt.getTime()).join(','),
      plotPointsCount: plotPoints.length,
      plotPointsUpdated: plotPoints.map(p => p.updatedAt.getTime()).join(','),
      timelineCount: timelineEvents.length,
      timelineUpdated: timelineEvents.map(t => t.updatedAt.getTime()).join(','),
      brainstormingCount: brainstormingNotes.length,
      brainstormingUpdated: brainstormingNotes.map(b => b.updatedAt.getTime()).join(','),
      scenesCount: sceneCards.length,
      scenesUpdated: sceneCards.map(s => s.updatedAt.getTime()).join(','),
      researchCount: research.length,
      researchUpdated: research.map(r => r.updatedAt.getTime()).join(',')
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');

    return NextResponse.json({ 
      hash,
      metadata: {
        chapters: chapters.length,
        characters: characters.length,
        locations: locations.length,
        plotPoints: plotPoints.length,
        timeline: timelineEvents.length,
        brainstorming: brainstormingNotes.length,
        scenes: sceneCards.length,
        research: research.length
      }
    });

  } catch (error) {
    console.error('Error generating content hash:', error);
    return NextResponse.json({
      error: 'Failed to generate content hash',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

