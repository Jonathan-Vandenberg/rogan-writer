import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { aiEmbeddingService } from '../ai-embedding.service';

export interface BrainstormingSuggestion {
  id: string;
  title: string;
  content: string;
  tags: string[];
  reasoning: string;
  confidence: number;
}

export class BrainstormingAgent extends AIAgent {
  async analyze(chapters: Chapter[], bookId: string): Promise<BrainstormingSuggestion[]> {
    console.log('💡 Brainstorming Agent: Starting analysis...');
    
    // Generate search query for brainstorming-related content
    const searchQuery = `brainstorming ideas themes concepts plot development creative inspiration writing prompts`;
    
    // Get book details and ALL existing brainstorming notes with full details
    const [book, allExistingNotes] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.brainstormingNote.findMany({
        where: { bookId },
        select: { title: true, content: true, tags: true, createdAt: true }
      })
    ]);

    // Use vector search to find content related to brainstorming concepts
    const [relevantNotes, relevantCharacters] = await Promise.all([
      aiEmbeddingService.findSimilarBrainstormingNotes(bookId, searchQuery, 20),
      aiEmbeddingService.findSimilarCharacters(bookId, searchQuery, 15)
    ]);
    
    const relevantContent = this.buildRelevantContentSummary(chapters, relevantNotes, relevantCharacters);
    
    // Simple list of existing content for AI to avoid
    const existingBrainstormingList = allExistingNotes.length > 0 
      ? allExistingNotes.map(note => `(${note.title}, ${note.content.substring(0, 100)}...)`).join(', ')
      : 'None yet';

    const prompt = `
      Analyze this book and suggest NEW brainstorming topics that would enhance story development.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      RELEVANT CONTENT (from vector similarity search):
      ${relevantContent}

      These are the current brainstorming topics, do not make suggestions based on these, create new ideas.
      Current brainstorming topics: [${existingBrainstormingList}]

      CRITICAL REQUIREMENTS:
      1. **CREATE COMPLETELY NEW IDEAS**: Do not suggest anything similar to the existing topics listed above
      2. **USE BOOK TITLE & DESCRIPTION AS PRIMARY SOURCE**: Base suggestions on the book's title, description, and genre
      3. **FILL GAPS**: Look for unexplored areas and suggest topics for those gaps
      4. **HIGH CONFIDENCE FOR BOOK-BASED SUGGESTIONS**: If suggestions are based on clear book concept, confidence should be 0.8-0.9

      For each suggestion, provide:
      1. A compelling title (2-5 words)
      2. Detailed content explaining the brainstorming topic (2-3 paragraphs)
      3. Reasoning for why this topic would be valuable
      4. Relevant tags (2-4 tags)
      5. Confidence score (0.0-1.0)

      Focus on:
      - Character development opportunities
      - Plot holes or unexplored areas
      - World-building elements
      - Thematic depth
      - Conflict enhancement
      - Setting expansion
      - Reader engagement strategies
      - Pacing improvements
      - Dialogue enhancement
      - Emotional depth opportunities

      Brainstorming Categories:
      - Character arcs and motivations
      - Plot complications and twists
      - World-building details
      - Thematic exploration
      - Scene improvements
      - Backstory development
      - Relationship dynamics
      - Conflict escalation
      - Atmosphere and mood
      - Symbolism and metaphor

      Return a JSON array with this exact structure:
      [
        {
          "title": "Title Here",
          "content": "Detailed brainstorming content here explaining the topic, providing questions to explore, and suggesting specific areas for development...",
          "reasoning": "Why this brainstorming topic would be valuable for the story development...",
          "tags": ["tag1", "tag2", "tag3"],
          "confidence": 0.85
        }
      ]

      Limit to 5 most important brainstorming suggestions.
      Ensure the JSON is valid and parseable.
    `;

    try {
      const response = await this.callOpenAI(prompt);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs
      const brainstormingSuggestions: BrainstormingSuggestion[] = suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `brainstorming_${Date.now()}_${index}`,
        title: suggestion.title || 'Untitled Topic',
        content: suggestion.content || 'No content provided',
        tags: Array.isArray(suggestion.tags) ? suggestion.tags : [],
        reasoning: suggestion.reasoning || '',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5
      }));

      console.log(`💡 Brainstorming Agent: Generated ${brainstormingSuggestions.length} unique suggestions (duplicates avoided at generation time)`);
      return brainstormingSuggestions;
    } catch (error) {
      console.error('Brainstorming Agent error:', error);
      return [];
    }
  }

  /**
   * Build comprehensive context of existing brainstorming content
   */
  private buildExistingContentContext(existingNotes: any[]): string {
    if (existingNotes.length === 0) {
      return 'No existing brainstorming content yet - you have a blank canvas!';
    }

    const existingContent = existingNotes
      .map((note, index) => 
        `${index + 1}. "${note.title}"\n   Content: ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}\n   Tags: ${note.tags?.join(', ') || 'None'}`
      )
      .join('\n\n');

    return `EXISTING BRAINSTORMING TOPICS (${existingNotes.length} total):\n${existingContent}`;
  }

  /**
   * Build a focused content summary from vector search results
   */
  private buildRelevantContentSummary(
    chapters: Chapter[], 
    relevantNotes: any[], 
    relevantCharacters: any[]
  ): string {
    const parts: string[] = [];

    // Add brief chapter summary
    if (chapters.length > 0) {
      const chapterSummary = chapters
        .slice(0, 3)
        .map(ch => `Chapter ${ch.orderIndex + 1}: ${ch.title}`)
        .join(', ');
      parts.push(`Chapters: ${chapterSummary}${chapters.length > 3 ? ` (and ${chapters.length - 3} more)` : ''}`);
    }

    // Add relevant brainstorming notes
    if (relevantNotes.length > 0) {
      const notesSummary = relevantNotes
        .map(note => `"${note.title}": ${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}`)
        .join('\n');
      parts.push(`Related Ideas:\n${notesSummary}`);
    }

    // Add relevant characters
    if (relevantCharacters.length > 0) {
      const charactersSummary = relevantCharacters
        .map(char => `${char.name}: ${char.description?.substring(0, 100) || 'No description'}${char.description && char.description.length > 100 ? '...' : ''}`)
        .join('\n');
      parts.push(`Related Characters:\n${charactersSummary}`);
    }

    return parts.length > 0 
      ? parts.join('\n\n') 
      : 'No relevant content found. Base suggestions on book title and description.';
  }
}
