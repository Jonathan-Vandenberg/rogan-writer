import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { PlanningContextService } from '../planning-context.service';

export interface CharacterSuggestion {
  id: string;
  name: string;
  description: string;
  role: 'PROTAGONIST' | 'ANTAGONIST' | 'MAJOR' | 'MINOR' | 'CAMEO';
  traits: string[];
  backstory: string;
  reasoning: string;
  confidence: number;
}

export class CharacterAgent extends AIAgent {
  // Override with extended signature and different return type
  async analyze(
    chapters: Chapter[], 
    bookId: string, 
    additionalContext?: any
  ): Promise<any> {
    // Extract parameters from additionalContext
    const existingSuggestions = additionalContext?.existingSuggestions as Array<{ name: string; description: string }> | undefined;
    const cachedContext = additionalContext?.cachedContext as string | null | undefined;
    const skipVectorSearch = additionalContext?.skipVectorSearch as boolean | undefined;
    console.log('👤 Character Agent: Starting analysis...');
    
    // Get book details and ALL existing characters
    const [book, allExistingCharacters] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.character.findMany({
        where: { bookId },
        select: { name: true, description: true, role: true, personality: true, backstory: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    let planningContext: string;

    // 💰 OPTIMIZATION: Use cached planning data if available
    if (skipVectorSearch && cachedContext) {
      console.log('👤 ⚡ Using CACHED planning context - skipping database fetch to save time!');
      planningContext = cachedContext;
    } else {
      console.log('👤 📚 Fetching comprehensive planning data from database...');
      // Fetch all planning data directly from database using shared service
      planningContext = await PlanningContextService.buildPlanningContext(bookId);
    }
    
    // Build DETAILED existing characters context to avoid duplicates
    // Include both saved characters AND suggestions from current session
    const allExisting = [
      ...allExistingCharacters.map(char => ({ name: char.name, description: char.description || '', role: char.role, personality: char.personality })),
      ...(existingSuggestions || []).map(s => ({ name: s.name, description: s.description, role: '', personality: '' }))
    ];
    
    const existingCharactersList = allExisting.length > 0 
      ? allExisting.map((char, i) => `${i + 1}. ${char.name} (${char.role || 'Unknown role'}): ${char.description.substring(0, 100)}${char.description.length > 100 ? '...' : ''}`).join('\n')
      : 'None yet';

    const prompt = `
      Analyze this book and suggest NEW characters that would enhance the story.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      COMPREHENSIVE BOOK PLANNING DATA:
      ${planningContext}

      EXISTING CHARACTERS (DO NOT DUPLICATE):
      ${existingCharactersList}

      CRITICAL REQUIREMENTS:
      1. **AVOID ALL DUPLICATES**: Carefully review existing characters above. Do NOT suggest anything similar in name, role, or description
      2. **USE ALL AVAILABLE CONTEXT**: Leverage plots, timeline, locations, brainstorming ideas, and scenes to identify missing characters
      3. **FILL CHARACTER GAPS**: Identify roles that need to be filled, relationships that need development, or character types that are missing
      4. **BE SPECIFIC**: Reference actual content from the book (plot events, locations, other characters)
      5. **NON-FICTION BOOKS**: If this appears to be a non-fiction book (biography, history, memoir, business, etc.), suggest REAL historical figures, experts, or actual people relevant to the book's theme and topic
      6. **HIGH CONFIDENCE**: Base suggestions on actual book content (0.7-0.9 confidence)

      For each character suggestion, provide:
      1. A unique name that fits the world
      2. Detailed physical and personality description
      3. Role in the story (PROTAGONIST, ANTAGONIST, MAJOR, MINOR, CAMEO)
      4. Key personality traits (3-4 traits)
      5. Brief backstory relevant to the plot
      6. Reasoning for why this character is needed
      7. Confidence score (0.0-1.0)

      Character roles:
      - PROTAGONIST: Main character driving the story
      - ANTAGONIST: Primary opposition to protagonist
      - MAJOR: Significant supporting character with own arc
      - MINOR: Important but limited role
      - CAMEO: Brief appearance but memorable

      Return a JSON array with this exact structure:
      [
        {
          "name": "Character Name",
          "description": "Physical appearance and personality description",
          "role": "PROTAGONIST|ANTAGONIST|MAJOR|MINOR|CAMEO",
          "traits": ["trait1", "trait2", "trait3"],
          "backstory": "Brief backstory relevant to the story",
          "reasoning": "Why this character is needed for the story",
          "confidence": 0.85
        }
      ]

      Limit to 5 most important character suggestions.
      Ensure the JSON is valid and parseable.
    `;

    try {
      const response = await this.callOpenAI(prompt);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs
      const characterSuggestions: CharacterSuggestion[] = suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `character_${Date.now()}_${index}`,
        name: suggestion.name || 'Unnamed Character',
        description: suggestion.description || 'No description provided',
        role: suggestion.role || 'MINOR',
        traits: Array.isArray(suggestion.traits) ? suggestion.traits : [],
        backstory: suggestion.backstory || '',
        reasoning: suggestion.reasoning || '',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5
      }));

      console.log(`👤 Character Agent: Generated ${characterSuggestions.length} unique suggestions (duplicates avoided at generation time)`);
      return {
        suggestions: characterSuggestions,
        context: planningContext // Return planning context for caching
      };
    } catch (error) {
      console.error('Character Agent error:', error);
      return {
        suggestions: [],
        context: planningContext || ''
      };
    }
  }
}
