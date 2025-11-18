import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { llmService } from '@/services/llm.service'
import { unifiedEmbeddingService } from '@/services/unified-embedding.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { message } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        genre: true,
        targetWords: true,
      }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // 🚀 UNIFIED VECTOR STORE: Search across ALL book content
    // (chapters, characters, locations, plot, timeline, brainstorming, scenes, research)
    
    // 🔍 Semantic search across all content types
    console.log(`🔍 Unified search for query: "${message}"`);
    
    const searchResults = await unifiedEmbeddingService.searchBookContent(bookId, message, 30);
    
    // Group results by source type for organized context
    const groupedResults = searchResults.reduce((acc, result) => {
      if (!acc[result.sourceType]) acc[result.sourceType] = [];
      acc[result.sourceType].push(result);
      return acc;
    }, {} as Record<string, typeof searchResults>);
    
    // Build rich context from all content types
    const contextParts: string[] = [];
    
    if (groupedResults.chapter) {
      const chaptersContext = groupedResults.chapter
        .map(r => `Chapter ${r.metadata.chapterNumber || '?'} - "${r.metadata.title}":\n${r.content}`)
        .join('\n\n');
      contextParts.push(`📖 CHAPTERS:\n${chaptersContext}`);
    }
    
    if (groupedResults.character) {
      const charactersContext = groupedResults.character
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`👤 CHARACTERS:\n${charactersContext}`);
    }
    
    if (groupedResults.location) {
      const locationsContext = groupedResults.location
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`📍 LOCATIONS:\n${locationsContext}`);
    }
    
    if (groupedResults.plotPoint) {
      const plotContext = groupedResults.plotPoint
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`📋 PLOT POINTS:\n${plotContext}`);
    }
    
    if (groupedResults.timeline) {
      const timelineContext = groupedResults.timeline
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`⏰ TIMELINE:\n${timelineContext}`);
    }
    
    if (groupedResults.brainstorming) {
      const brainstormContext = groupedResults.brainstorming
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`💡 BRAINSTORMING IDEAS:\n${brainstormContext}`);
    }
    
    if (groupedResults.sceneCard) {
      const sceneContext = groupedResults.sceneCard
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`🎬 SCENES:\n${sceneContext}`);
    }
    
    if (groupedResults.research) {
      const researchContext = groupedResults.research
        .map(r => r.content)
        .join('\n\n');
      contextParts.push(`🔬 RESEARCH:\n${researchContext}`);
    }
    
    const relevantContext = contextParts.length > 0 
      ? contextParts.join('\n\n---\n\n') 
      : 'No relevant book content found.';

    // AI Assistant prompt - Use AI's general knowledge when book content doesn't have the answer
    const systemPrompt = `You are an AI assistant for the book "${book.title}". You have access to the book's chapter content below. Answer questions intelligently.

${relevantContext}

Instructions:
- PRIMARILY answer based on the book content above when the question is about the book
- If something is mentioned in the book content, describe it accurately
- If asked about the book but the content doesn't mention something, say so clearly
- For general knowledge questions (history, facts, definitions, etc.), use your own knowledge
- Be helpful and detailed in your responses
- Never claim you don't have access to information - you have both the book content and general knowledge`

    const userPrompt = message

    // Use local model in development, GPT-3.5-turbo in production for cheaper responses
    // Pass userId to allow OpenRouter integration
    const response = await llmService.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-3.5-turbo', // Use default model in dev
        temperature: 0.7,
        max_tokens: 2000, // Increased for more comprehensive responses
        userId: session.user.id, // Pass userId for OpenRouter config
      }
    )

    const aiResponse = response.content?.trim() || 'Sorry, I could not generate a response.'

    // Build detailed source metadata
    const sources = {
      chapters: groupedResults.chapter?.map(r => ({
        title: r.metadata.title,
        chapterNumber: r.metadata.chapterNumber,
        similarity: r.similarity
      })) || [],
      characters: groupedResults.character?.map(r => ({
        name: r.metadata.name,
        role: r.metadata.role,
        similarity: r.similarity
      })) || [],
      locations: groupedResults.location?.map(r => ({
        name: r.metadata.name,
        similarity: r.similarity
      })) || [],
      plotPoints: groupedResults.plotPoint?.map(r => ({
        title: r.metadata.title,
        type: r.metadata.type,
        similarity: r.similarity
      })) || [],
      timeline: groupedResults.timeline?.map(r => ({
        title: r.metadata.title,
        eventDate: r.metadata.eventDate,
        similarity: r.similarity
      })) || [],
      brainstorming: groupedResults.brainstorming?.map(r => ({
        title: r.metadata.title,
        tags: r.metadata.tags,
        similarity: r.similarity
      })) || [],
      scenes: groupedResults.sceneCard?.map(r => ({
        title: r.metadata.title,
        similarity: r.similarity
      })) || [],
      research: groupedResults.research?.map(r => ({
        title: r.metadata.title,
        similarity: r.similarity
      })) || [],
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      contextUsed: {
        totalChunks: searchResults.length,
        chapters: groupedResults.chapter?.length || 0,
        characters: groupedResults.character?.length || 0,
        locations: groupedResults.location?.length || 0,
        plotPoints: groupedResults.plotPoint?.length || 0,
        timeline: groupedResults.timeline?.length || 0,
        brainstorming: groupedResults.brainstorming?.length || 0,
        scenes: groupedResults.sceneCard?.length || 0,
        research: groupedResults.research?.length || 0,
      },
      sources // Detailed source metadata
    })

  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ 
      error: 'Failed to process AI chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
