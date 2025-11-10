import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { llmService } from '@/services/llm.service'
import { aiEmbeddingService } from '@/services/ai-embedding.service'

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

    // 🚀 AUTO-GENERATE EMBEDDINGS: Ensure chapters have embeddings before search
    const chaptersNeedingEmbeddings = await prisma.$queryRaw<Array<{ id: string; title: string }>>`
      SELECT id, title 
      FROM chapters 
      WHERE "bookId" = ${bookId} 
        AND content IS NOT NULL 
        AND embedding IS NULL
    `;
    
    if (chaptersNeedingEmbeddings.length > 0) {
      console.log(`🤖 AI Chat: Generating embeddings for ${chaptersNeedingEmbeddings.length} chapters...`)
      
      // Generate embeddings for chapters that need them
      for (const chapter of chaptersNeedingEmbeddings) {
        try {
          await aiEmbeddingService.updateChapterEmbedding(chapter.id);
        } catch (error) {
          console.error(`❌ Failed to generate embedding for ${chapter.title}:`, error);
        }
      }
    }
    
    // 🎯 SIMPLE APPROACH: Fetch ALL chapters directly from database
    // No vector search needed since we want full context anyway
    let relevantChapters: Array<{
      id: string;
      title: string;
      content: string | null;
      description: string | null;
      orderIndex: number;
    }> = [];
    
    // Check if user is asking about a specific chapter number
    const chapterNumberMatch = message.match(/chapter\s+(\d+)/i);
    
    // Also check for ordinal references like "first chapter", "second chapter", etc.
    const ordinalMatch = message.match(/(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-first|twenty-second|twenty-third|twenty-fourth|twenty-fifth|twenty-sixth|twenty-seventh|twenty-eighth|twenty-ninth|thirtieth|\d+(?:st|nd|rd|th))\s+chapter/i);
    
    let requestedChapterNumber = null;
    
    if (chapterNumberMatch) {
      requestedChapterNumber = parseInt(chapterNumberMatch[1]);
    } else if (ordinalMatch) {
      const ordinalText = ordinalMatch[0].toLowerCase();
      // Map ordinals to numbers
      const ordinalMap: Record<string, number> = {
        'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
        'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
        'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14, 'fifteenth': 15,
        'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18, 'nineteenth': 19, 'twentieth': 20,
        'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23, 'twenty-fourth': 24, 'twenty-fifth': 25,
        'twenty-sixth': 26, 'twenty-seventh': 27, 'twenty-eighth': 28, 'twenty-ninth': 29, 'thirtieth': 30
      };
      
      // Check for word ordinals
      for (const [word, num] of Object.entries(ordinalMap)) {
        if (ordinalText.includes(word)) {
          requestedChapterNumber = num;
          break;
        }
      }
      
      // Check for numbered ordinals (1st, 2nd, 3rd, etc.)
      if (!requestedChapterNumber) {
        const numMatch = ordinalText.match(/(\d+)(?:st|nd|rd|th)/);
        if (numMatch) {
          requestedChapterNumber = parseInt(numMatch[1]);
        }
      }
    }
    
    if (requestedChapterNumber) {
      // Direct lookup by chapter number (orderIndex) using raw query
      const specificChapters = await prisma.$queryRaw<Array<{
        id: string;
        title: string;
        content: string | null;
        description: string | null;
        orderIndex: number;
      }>>`
        SELECT id, title, content, description, "orderIndex"
        FROM chapters 
        WHERE "bookId" = ${bookId} 
          AND "orderIndex" = ${requestedChapterNumber - 1}
          AND content IS NOT NULL
        LIMIT 1
      `;
      
      const specificChapter = specificChapters[0] || null;
      
      if (specificChapter) {
        relevantChapters = [{
          id: specificChapter.id,
          title: specificChapter.title,
          content: specificChapter.content,
          description: specificChapter.description,
          orderIndex: specificChapter.orderIndex
        }];
      } else {
        relevantChapters = [];
      }
    } else {
      // 🔍 PURE VECTOR SEARCH: Use semantic similarity to find ALL relevant chapters
      console.log(`🔍 Vector search for query: "${message}"`);
      
      const vectorResults = await aiEmbeddingService.findSimilarChapters(bookId, message, 1000);
      
      relevantChapters = vectorResults.map(ch => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        description: ch.description,
        orderIndex: 0 // Will be fetched later if needed
      }));
      
      console.log(`📚 Found ${relevantChapters.length} chapters from vector search`);
    }

    // Build context from relevant chapters
    let relevantContext = '';
    
    if (relevantChapters.length > 0) {
      // For direct chapter lookups, we might have orderIndex. For vector searches, we need to look it up.
      const needsChapterNumbers = !requestedChapterNumber;
      let chaptersWithNumbers: Array<{ id: string; orderIndex: number }> = [];
      
      if (needsChapterNumbers) {
        chaptersWithNumbers = await prisma.chapter.findMany({
          where: { 
            bookId,
            id: { in: relevantChapters.map(ch => ch.id) }
          },
          select: { id: true, orderIndex: true }
        });
      }
      
      const chaptersContext = relevantChapters
        .map(ch => {
          let chapterNumber = '?';
          if (requestedChapterNumber) {
            // For direct lookups, we know it's the requested chapter
            chapterNumber = requestedChapterNumber.toString();
          } else if (needsChapterNumbers) {
            // For vector searches, look up the chapter number
            const chapterData = chaptersWithNumbers.find(c => c.id === ch.id);
            chapterNumber = chapterData ? (chapterData.orderIndex + 1).toString() : '?';
          }
          
          return `Chapter ${chapterNumber} - "${ch.title}":\n${ch.content || ch.description || 'No content'}`;
        })
        .join('\n\n')
      relevantContext = `Book content:\n${chaptersContext}`;
    } else {
      relevantContext = 'No relevant book content found.';
    }

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
    const response = await llmService.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-3.5-turbo', // Use default model in dev
        temperature: 0.7,
        max_tokens: 2000, // Increased for more comprehensive responses
      }
    )

    const aiResponse = response.content?.trim() || 'Sorry, I could not generate a response.'

    return NextResponse.json({
      success: true,
      response: aiResponse,
      contextUsed: {
        chapters: relevantChapters.length,
      }
    })

  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ 
      error: 'Failed to process AI chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
