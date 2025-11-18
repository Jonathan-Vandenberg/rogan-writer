/**
 * AI Analysis API Endpoint
 * 
 * Handles AI-powered analysis requests for books to generate planning suggestions
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Force dynamic rendering to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AnalyzeRequest {
  type: 'brainstorming' | 'characters' | 'plot' | 'locations' | 'scenes' | 'full';
  options?: {
    generateEmbeddings?: boolean;
    maxSuggestions?: number;
    subplot?: string;
    generateStructures?: boolean;
    existingSuggestions?: Array<{ title: string; content?: string; description?: string }>;
    cachedContext?: string | null;
    skipVectorSearch?: boolean;
    customDirection?: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body = await request.json() as AnalyzeRequest;
    const { type, options = {} } = body;

    // Verify user owns the book
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id
      }
    });

    if (!book) {
      return Response.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    console.log(`Starting AI analysis for book ${bookId}, type: ${type}`);

    // Dynamically import services to avoid build-time errors
    const { aiEmbeddingService } = await import('@/services/ai-embedding.service');
    const { AIOrchestrator } = await import('@/services/ai-orchestrator.service');

    // Generate embeddings if requested (useful for first-time setup)
    if (options.generateEmbeddings) {
      console.log('Generating embeddings for book content...');
      try {
        await aiEmbeddingService.generateBookEmbeddings(bookId);
      } catch (embeddingError) {
        console.warn('Embedding generation failed, continuing with analysis:', embeddingError);
      }
    }

    // Initialize AI Orchestrator
    const aiOrchestrator = new AIOrchestrator();

    // Perform analysis based on type
    switch (type) {
      case 'brainstorming':
        const brainstormingResult = await aiOrchestrator.analyzeModule(
          'brainstorming', 
          bookId, 
          { 
            existingSuggestions: options.existingSuggestions || [],
            cachedContext: options.cachedContext,
            skipVectorSearch: options.skipVectorSearch
          }
        ) as unknown as { suggestions: any[], context: string };
        return Response.json({
          type: 'brainstorming',
          suggestions: brainstormingResult.suggestions.slice(0, options.maxSuggestions || 5),
          context: brainstormingResult.context, // Return context for caching
          metadata: {
            analysisDate: new Date(),
            suggestionCount: brainstormingResult.suggestions.length,
            usedCache: options.skipVectorSearch || false
          }
        });

      case 'characters':
        const characterResult = await aiOrchestrator.analyzeModule(
          'characters', 
          bookId, 
          { 
            existingSuggestions: options.existingSuggestions || [],
            cachedContext: options.cachedContext,
            skipVectorSearch: options.skipVectorSearch
          }
        ) as unknown as { suggestions: any[], context: string };
        return Response.json({
          type: 'characters',
          suggestions: characterResult.suggestions.slice(0, options.maxSuggestions || 5),
          context: characterResult.context, // Return context for caching
          metadata: {
            analysisDate: new Date(),
            suggestionCount: characterResult.suggestions.length,
            usedCache: options.skipVectorSearch || false
          }
        });

      case 'locations':
        const locationResult = await aiOrchestrator.analyzeModule(
          'locations', 
          bookId, 
          { 
            existingSuggestions: options.existingSuggestions || [],
            cachedContext: options.cachedContext,
            skipVectorSearch: options.skipVectorSearch
          }
        ) as unknown as { suggestions: any[], context: string };
        return Response.json({
          type: 'locations',
          suggestions: locationResult.suggestions.slice(0, options.maxSuggestions || 5),
          context: locationResult.context, // Return context for caching
          metadata: {
            analysisDate: new Date(),
            suggestionCount: locationResult.suggestions.length,
            usedCache: options.skipVectorSearch || false
          }
        });

      case 'scenes':
        const sceneResult = await aiOrchestrator.analyzeModule(
          'scenes', 
          bookId, 
          { 
            existingSuggestions: options.existingSuggestions || [],
            cachedContext: options.cachedContext,
            skipVectorSearch: options.skipVectorSearch
          }
        ) as unknown as { suggestions: any[], context: string };
        return Response.json({
          type: 'scenes',
          suggestions: sceneResult.suggestions.slice(0, options.maxSuggestions || 5),
          context: sceneResult.context, // Return context for caching
          metadata: {
            analysisDate: new Date(),
            suggestionCount: sceneResult.suggestions.length,
            usedCache: options.skipVectorSearch || false
          }
        });

      case 'plot':
        const plotResult = await aiOrchestrator.analyzeModule('plot', bookId, { 
          subplot: options.subplot,
          generateStructures: options.generateStructures,
          existingSuggestions: options.existingSuggestions || [],
          cachedContext: options.cachedContext,
          skipVectorSearch: options.skipVectorSearch,
          customDirection: options.customDirection
        }) as unknown as { suggestions: any[], context: string } | any[];
        
        // Handle both plot structures and individual plot points
        if (options.generateStructures && !Array.isArray(plotResult)) {
          return Response.json({
            type: 'plot',
            suggestions: plotResult.suggestions.slice(0, options.maxSuggestions || 5),
            context: plotResult.context,
            metadata: {
              analysisDate: new Date(),
              suggestionCount: plotResult.suggestions.length,
              usedCache: options.skipVectorSearch || false
            }
          });
        } else {
          const plotSuggestions = Array.isArray(plotResult) ? plotResult : plotResult.suggestions || [];
          return Response.json({
            type: 'plot',
            suggestions: plotSuggestions.slice(0, options.maxSuggestions || 5),
            metadata: {
              analysisDate: new Date(),
              suggestionCount: plotSuggestions.length,
              subplot: options.subplot || 'main'
            }
          });
        }

      case 'full':
        const fullAnalysis = await aiOrchestrator.comprehensiveAnalysis(bookId);
        return Response.json({
          type: 'full',
          ...fullAnalysis
        });

      default:
        return Response.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

  } catch (error) {
    console.error('AI analysis error:', error);
    
    // Return appropriate error message
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return Response.json({ 
          error: 'AI service configuration error. Please check API keys.' 
        }, { status: 500 });
      }
      
      if (error.message.includes('rate limit')) {
        return Response.json({ 
          error: 'AI service rate limit exceeded. Please try again later.' 
        }, { status: 429 });
      }
    }

    return Response.json({ 
      error: 'Analysis failed. Please try again later.' 
    }, { status: 500 });
  }
}

// Support for testing the endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

    // Verify user owns the book
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id
      },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            chapters: true,
            brainstormingNotes: true,
            characters: true
          }
        }
      }
    });

    if (!book) {
      return Response.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    // Dynamically import service to avoid build-time errors
    const { aiEmbeddingService } = await import('@/services/ai-embedding.service');
    
    // Test vector search functionality
    const vectorSearchTest = await aiEmbeddingService.testVectorSearch(bookId);

    return Response.json({
      message: 'AI Analysis endpoint is ready',
      book: {
        id: book.id,
        title: book.title,
        chapters: book._count.chapters,
        brainstormingNotes: book._count.brainstormingNotes,
        characters: book._count.characters
      },
      vectorSearchEnabled: vectorSearchTest,
      availableAnalysisTypes: ['brainstorming', 'characters', 'full'],
      usage: {
        POST: 'Send { "type": "brainstorming" | "characters" | "full" } to analyze',
        options: {
          generateEmbeddings: 'Generate embeddings for content (first time setup)',
          maxSuggestions: 'Limit number of suggestions returned'
        }
      }
    });

  } catch (error) {
    console.error('AI analysis endpoint test error:', error);
    return Response.json({ 
      error: 'Endpoint test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
