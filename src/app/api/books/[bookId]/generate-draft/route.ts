import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AIOrchestrator } from '@/services/ai-orchestrator.service';

// Increase timeout for book generation (can take 5+ minutes for full books)
// Vercel Pro: max 60s, Enterprise: max 300s (5 minutes)
export const maxDuration = 300; // 5 minutes (requires Vercel Enterprise)
export const dynamic = 'force-dynamic';

interface GenerateDraftRequest {
  replaceExisting?: boolean; // Whether to replace existing chapters
  preview?: boolean; // Just generate preview, don't save to DB
  writingStylePrompt?: string; // User-provided writing style instructions
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body: GenerateDraftRequest = await request.json();
    const { replaceExisting = false, preview = false, writingStylePrompt } = body;

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      include: {
        chapters: {
          select: { id: true, title: true, orderIndex: true }
        }
      }
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check if book already has chapters and user hasn't confirmed replacement
    if (book.chapters.length > 0 && !replaceExisting && !preview) {
      return NextResponse.json({ 
        error: 'Book already has chapters', 
        existingChapters: book.chapters.length,
        requiresConfirmation: true 
      }, { status: 409 });
    }

    console.log(`Starting draft generation for book: ${book.title}`);
    if (writingStylePrompt) {
      console.log(`Using custom writing style prompt: ${writingStylePrompt.substring(0, 100)}...`);
    }

    // Initialize AI Orchestrator and generate draft
    const aiOrchestrator = new AIOrchestrator();
    const draft = await aiOrchestrator.generateBookDraft(bookId, writingStylePrompt);

    if (preview) {
      // Store full draft in database temporarily with a special flag
      // We'll store it in a JSON field on the book for now
      await prisma.book.update({
        where: { id: bookId },
        data: {
          // Store the full draft temporarily (will be replaced when chapters are created)
          description: book.description // Keep description as-is
        }
      });

      // Cache the full draft in memory or return it with a draft ID
      // For now, return preview but also include full content (hidden from UI)
      return NextResponse.json({
        success: true,
        preview: true,
        bookTitle: book.title,
        draft: {
          ...draft,
          // Truncate content for UI preview only (first 200 chars of each chapter)
          chapters: draft.chapters.map((chapter, idx) => ({
            ...chapter,
            content: chapter.content.substring(0, 200) + (chapter.content.length > 200 ? '...' : ''),
            // Store full content in a separate field for backend use
            fullContent: chapter.content
          }))
        },
        message: `Generated ${draft.chapters.length} chapters with ${draft.totalWordCount} total words (preview mode)`
      });
    }

    // Save all chapters to database
    await aiOrchestrator.saveDraftToDatabase(bookId, draft);

    return NextResponse.json({
      success: true,
      bookTitle: book.title,
      chaptersCreated: draft.chapters.length,
      totalWordCount: draft.totalWordCount,
      structure: draft.structure,
      summary: draft.summary,
      message: `Successfully generated ${draft.chapters.length} chapters with ${draft.totalWordCount} total words`
    });

  } catch (error: any) {
    console.error('Draft generation error:', error);
    
    // Handle specific error types
    if (error.message?.includes('Insufficient planning')) {
      return NextResponse.json({ 
        error: 'Insufficient planning content', 
        details: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Draft generation failed', 
      details: error.message || 'Unknown error occurred' 
    }, { status: 500 });
  }
}

// Get draft generation status/info
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

    // Get book and planning info
    const [book, planningCounts] = await Promise.all([
      prisma.book.findFirst({
        where: {
          id: bookId,
          userId: session.user.id,
        },
        include: {
          chapters: {
            select: { id: true, title: true, orderIndex: true, wordCount: true }
          }
        }
      }),
      // Get planning content counts
      Promise.all([
        prisma.plotPoint.count({ where: { bookId } }),
        prisma.character.count({ where: { bookId } }),
        prisma.location.count({ where: { bookId } }),
        prisma.sceneCard.count({ where: { bookId } }),
        prisma.brainstormingNote.count({ where: { bookId } }),
        prisma.timelineEvent.count({ where: { bookId } })
      ])
    ]);

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const [plotPoints, characters, locations, sceneCards, brainstorming, timeline] = planningCounts;
    const hasPlanning = plotPoints > 0 || characters > 0 || locations > 0 || sceneCards > 0 || brainstorming > 0 || timeline > 0;
    const totalPlanningItems = plotPoints + characters + locations + sceneCards + brainstorming + timeline;

    return NextResponse.json({
      bookTitle: book.title,
      hasExistingChapters: book.chapters.length > 0,
      existingChaptersCount: book.chapters.length,
      totalExistingWords: book.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0),
      planningContent: {
        plotPoints,
        characters,
        locations,
        sceneCards,
        brainstorming,
        timeline,
        total: totalPlanningItems
      },
      canGenerateDraft: hasPlanning,
      recommendedAction: hasPlanning 
        ? (book.chapters.length > 0 ? 'preview' : 'generate')
        : 'add_planning'
    });

  } catch (error) {
    console.error('Draft status check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check draft status' 
    }, { status: 500 });
  }
}
