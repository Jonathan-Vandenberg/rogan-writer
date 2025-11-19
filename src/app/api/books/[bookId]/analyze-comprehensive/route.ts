import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AIOrchestrator } from '@/services/ai-orchestrator.service';

// Increase timeout for comprehensive analysis (can take several minutes)
// Vercel Pro: max 60s, Enterprise: max 300s (5 minutes)
export const maxDuration = 300; // 5 minutes (requires Vercel Enterprise)
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    const { bookId } = await params;

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

    console.log('Starting comprehensive analysis for book:', book.title);

    // Initialize AI Orchestrator and perform comprehensive analysis
    const aiOrchestrator = new AIOrchestrator();
    const analysisResult = await aiOrchestrator.comprehensiveAnalysis(bookId);

    return NextResponse.json({
      success: true,
      bookTitle: book.title,
      analysisResult,
      metadata: {
        analysisDate: new Date().toISOString(),
        totalSuggestions: 
          analysisResult.timeline.length +
          analysisResult.characters.length +
          analysisResult.locations.length +
          analysisResult.plotPoints.length +
          analysisResult.sceneCards.length +
          analysisResult.brainstorming.length,
        suggestionsByModule: {
          timeline: analysisResult.timeline.length,
          characters: analysisResult.characters.length,
          locations: analysisResult.locations.length,
          plotPoints: analysisResult.plotPoints.length,
          sceneCards: analysisResult.sceneCards.length,
          brainstorming: analysisResult.brainstorming.length,
        }
      }
    });

  } catch (error: any) {
    console.error('Error in comprehensive analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze book',
      details: error.message 
    }, { status: 500 });
  }
}
