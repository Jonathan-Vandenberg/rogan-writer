import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { PlanningContextService } from '../planning-context.service';

export interface LocationSuggestion {
  id: string;
  name: string;
  description: string;
  geography?: string;
  culture?: string;
  reasoning: string;
  confidence: number;
}

export class LocationAgent extends AIAgent {
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
    const customIdea = additionalContext?.customIdea as string | undefined;
    console.log('🏰 Location Agent: Starting analysis...');
    
    // Get book details and ALL existing locations
    const [book, allExistingLocations] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.location.findMany({
        where: { bookId },
        select: { name: true, description: true, geography: true, culture: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    let planningContext: string;

    // 💰 OPTIMIZATION: Use cached planning data if available
    if (skipVectorSearch && cachedContext) {
      console.log('🏰 ⚡ Using CACHED planning context - skipping database fetch to save time!');
      planningContext = cachedContext;
    } else {
      console.log('🏰 📚 Fetching comprehensive planning data from database...');
      // Fetch all planning data directly from database using shared service
      planningContext = await PlanningContextService.buildPlanningContext(bookId);
    }
    
    // Build DETAILED existing locations context to avoid duplicates
    // Include both saved locations AND suggestions from current session
    const allExisting = [
      ...allExistingLocations.map(loc => ({ name: loc.name, description: loc.description || '', geography: loc.geography })),
      ...(existingSuggestions || []).map(s => ({ name: s.name, description: s.description, geography: '' }))
    ];
    
    const existingLocationsList = allExisting.length > 0 
      ? allExisting.map((loc, i) => `${i + 1}. ${loc.name}: ${loc.description.substring(0, 100)}${loc.description.length > 100 ? '...' : ''}`).join('\n')
      : 'None yet';

    const prompt = `
      Analyze this book and suggest NEW locations that would enhance the story's world-building.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      COMPREHENSIVE BOOK PLANNING DATA:
      ${planningContext}

      EXISTING LOCATIONS (DO NOT DUPLICATE):
      ${existingLocationsList}

      ${customIdea ? `CUSTOM LOCATION IDEA:\n${customIdea}\n\nUse this idea as the basis for location suggestions.` : ''}

      CRITICAL REQUIREMENTS:
      1. **AVOID ALL DUPLICATES**: Carefully review existing locations above. Do NOT suggest anything similar in name, description, or setting
      2. **USE ALL AVAILABLE CONTEXT**: Leverage plots, timeline, characters, brainstorming ideas, and scenes to identify missing locations
      3. **FILL LOCATION GAPS**: Identify settings that are needed but missing, places mentioned in plots/scenes, or locations that would enhance world-building
      4. **BE SPECIFIC**: Reference actual content from the book (plot events, character needs, story requirements)
      5. **NON-FICTION BOOKS**: If this appears to be a non-fiction book (biography, history, memoir, business, etc.), suggest REAL places relevant to the book's theme and topic
      6. **HIGH CONFIDENCE**: Base suggestions on actual book content (0.7-0.9 confidence)

      For each location suggestion, provide:
      1. A unique name that fits the world's style
      2. Detailed description of the location
      3. Geographic characteristics (terrain, climate, features)
      4. Cultural aspects (if inhabited - customs, architecture, atmosphere)
      5. Reasoning for why this location is needed
      6. Confidence score (0.0-1.0)

      Focus on locations that:
      - Are mentioned but not fully described
      - Would serve important plot functions
      - Add depth to the world-building
      - Create interesting settings for character interactions
      - Support the story's themes and atmosphere

      Return a JSON array with this exact structure:
      [
        {
          "name": "Location Name",
          "description": "Detailed description of the location",
          "geography": "Physical characteristics, terrain, climate",
          "culture": "Cultural aspects if relevant (architecture, customs, atmosphere)",
          "reasoning": "Why this location is needed for the story",
          "confidence": 0.85
        }
      ]

      Limit to 5 most important location suggestions.
      Ensure the JSON is valid and parseable.
    `;

    try {
      const response = await this.callOpenAI(prompt, bookId);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs
      const locationSuggestions: LocationSuggestion[] = suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `location_${Date.now()}_${index}`,
        name: suggestion.name || 'Unnamed Location',
        description: suggestion.description || 'No description provided',
        geography: suggestion.geography || '',
        culture: suggestion.culture || '',
        reasoning: suggestion.reasoning || '',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5
      }));

      console.log(`🏰 Location Agent: Generated ${locationSuggestions.length} unique suggestions (duplicates avoided at generation time)`);
      return {
        suggestions: locationSuggestions,
        context: planningContext // Return planning context for caching
      };
    } catch (error) {
      console.error('Location Agent error:', error);
      return {
        suggestions: [],
        context: planningContext || ''
      };
    }
  }
}
