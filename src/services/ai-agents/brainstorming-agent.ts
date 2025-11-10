import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { PlanningContextService } from '../planning-context.service';

export interface BrainstormingSuggestion {
  id: string;
  title: string;
  content: string;
  tags: string[];
  reasoning: string;
  confidence: number;
}

export class BrainstormingAgent extends AIAgent {
  // Override with extended signature and different return type
  async analyze(
    chapters: Chapter[], 
    bookId: string, 
    additionalContext?: any
  ): Promise<any> {
    // Extract parameters from additionalContext
    const existingSuggestions = additionalContext?.existingSuggestions as Array<{ title: string; content: string }> | undefined;
    const cachedContext = additionalContext?.cachedContext as string | null | undefined;
    const skipVectorSearch = additionalContext?.skipVectorSearch as boolean | undefined;
    console.log('💡 Brainstorming Agent: Starting analysis...');
    
    // Get book details and ALL existing brainstorming notes
    const [book, allExistingNotes] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.brainstormingNote.findMany({
        where: { bookId },
        select: { title: true, content: true, tags: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    let planningContext: string;

    // 💰 OPTIMIZATION: Use cached planning data if available
    if (skipVectorSearch && cachedContext) {
      console.log('💡 ⚡ Using CACHED planning context - skipping database fetch to save time!');
      planningContext = cachedContext;
    } else {
      console.log('💡 📚 Fetching comprehensive planning data from database...');
      // Fetch all planning data directly from database using shared service
      planningContext = await PlanningContextService.buildPlanningContext(bookId);
    }
    
    // Build DETAILED existing brainstorming context to avoid duplicates
    // Include both saved notes AND suggestions from current session
    const allExisting = [
      ...allExistingNotes.map(note => ({ title: note.title, content: note.content, tags: note.tags })),
      ...(existingSuggestions || []).map(s => ({ title: s.title, content: s.content, tags: [] }))
    ];
    
    const existingBrainstormingList = allExisting.length > 0 
      ? allExisting.map((item, i) => `${i + 1}. "${item.title}"\n   Synopsis: ${item.content.substring(0, 150)}...\n   Tags: ${item.tags?.join(', ') || 'none'}`).join('\n\n')
      : 'None yet - fresh start!';

    const prompt = `
      Analyze this book and suggest NEW brainstorming topics that would enhance story development.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      COMPREHENSIVE PLANNING DATA (plots, timelines, characters, locations, brainstorms, scenes, research, chapter titles):
      ${planningContext}

      EXISTING BRAINSTORMING IDEAS (DO NOT DUPLICATE - CREATE COMPLETELY NEW IDEAS):
      ${existingBrainstormingList}

      CRITICAL REQUIREMENTS:
      1. **AVOID ALL DUPLICATES**: Carefully review existing ideas above. Do NOT suggest anything similar in theme, topic, or approach
      2. **USE ALL AVAILABLE CONTEXT**: Leverage chapters, characters, locations, plot points, timeline, scenes, and research to find gaps
      3. **FILL STORY GAPS**: Identify unexplored areas, underdeveloped aspects, or missing elements
      4. **BE SPECIFIC**: Reference actual content from the book (character names, locations, plot events)
      5. **HIGH CONFIDENCE**: Base suggestions on actual book content (0.7-0.9 confidence)

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
      return {
        suggestions: brainstormingSuggestions,
        context: planningContext // Return planning context for caching
      };
    } catch (error) {
      console.error('Brainstorming Agent error:', error);
      return {
        suggestions: [],
        context: planningContext || ''
      };
    }
  }

}
