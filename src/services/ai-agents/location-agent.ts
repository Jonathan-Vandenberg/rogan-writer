import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { aiEmbeddingService } from '../ai-embedding.service';

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
  async analyze(chapters: Chapter[], bookId: string): Promise<LocationSuggestion[]> {
    console.log('🏰 Location Agent: Starting analysis...');
    
    // Generate search query for location-related content
    const searchQuery = `location setting world building geography culture environment atmosphere places`;
    
    // Use comprehensive vector search to find ALL relevant content - FULL CONTEXT ACCESS
    const relevantNotes = await aiEmbeddingService.findSimilarBrainstormingNotes(bookId, searchQuery, 100);
    
    // Create focused content summary from vector search results
    const relevantContent = this.buildRelevantContentSummary(chapters, relevantNotes);
    
    // Get book details and existing locations
    const [book, existingLocations] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.location.findMany({
        where: { bookId },
        select: { name: true, description: true, geography: true }
      })
    ]);

    // Simple list of existing locations for AI to avoid
    const existingLocationsList = existingLocations.length > 0 
      ? existingLocations.map(loc => `(${loc.name}, ${loc.description?.substring(0, 100) || 'No description'}...)`).join(', ')
      : 'None yet';

    const prompt = `
      Analyze this book and suggest NEW locations that would enhance the story's world-building.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      RELEVANT CONTENT (from vector similarity search):
      ${relevantContent}

      These are the current locations, do not make suggestions based on these, create new locations.
      Current locations: [${existingLocationsList}]

      CRITICAL REQUIREMENTS:
      1. **CREATE COMPLETELY NEW LOCATIONS**: Do not suggest anything similar to the existing locations listed above
      2. **USE BOOK TITLE & DESCRIPTION AS PRIMARY SOURCE**: Base location suggestions on the book's title, description, and genre
      3. Focus on locations that are mentioned or implied but not yet detailed
      4. Consider locations needed for future plot development
      5. Ensure each location serves a specific narrative purpose
      6. **HIGH CONFIDENCE FOR BOOK-BASED SUGGESTIONS**: If suggestions are based on clear book concept, confidence should be 0.8-0.9

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
      const response = await this.callOpenAI(prompt);
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
      return locationSuggestions;
    } catch (error) {
      console.error('Location Agent error:', error);
      return [];
    }
  }

  /**
   * Filter out duplicate location suggestions using vector similarity
   */
  private async filterDuplicateLocations(suggestions: LocationSuggestion[], bookId: string): Promise<LocationSuggestion[]> {
    try {
      const filteredSuggestions: LocationSuggestion[] = [];
      
      for (const suggestion of suggestions) {
        // Create search query from location details
        const locationQuery = `${suggestion.name} ${suggestion.description} ${suggestion.geography} ${suggestion.culture}`;
        
        // Find similar existing locations using vector search
        const similarLocations = await aiEmbeddingService.findSimilarLocations(bookId, locationQuery, 5);
        
        // Check if any existing location is too similar (similarity > 0.8 means likely duplicate)
        const isDuplicate = similarLocations.some(existing => {
          // Name similarity check
          const nameSimilar = this.areStringsSimilar(suggestion.name, existing.name);
          
          // High vector similarity indicates conceptual duplicate
          const highSimilarity = existing.similarity && existing.similarity > 0.8;
          
          return nameSimilar || highSimilarity;
        });
        
        if (!isDuplicate) {
          filteredSuggestions.push(suggestion);
        } else {
          console.log(`🚫 Location Agent: Filtered out duplicate suggestion "${suggestion.name}"`);
        }
      }
      
      return filteredSuggestions;
    } catch (error) {
      console.error('Error filtering duplicate locations:', error);
      // Return original suggestions if filtering fails
      return suggestions;
    }
  }

  /**
   * Check if two strings are similar (handles variations like "Forest" vs "Dark Forest")
   */
  private areStringsSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return true;
    
    // Check if one is contained in the other (handles "Forest" vs "Dark Forest")
    if (s1.includes(s2) || s2.includes(s1)) return true;
    
    // Word overlap similarity for location names
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) return true;
    
    const similarity = intersection.size / union.size;
    return similarity >= threshold;
  }

  /**
   * Build a focused content summary from vector search results
   */
  private buildRelevantContentSummary(chapters: Chapter[], relevantNotes: any[]): string {
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
        .map(note => `"${note.title}": ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}`)
        .join('\n');
      parts.push(`Relevant Ideas:\n${notesSummary}`);
    }

    return parts.length > 0 
      ? parts.join('\n\n') 
      : 'No relevant content found. Base suggestions on book title and description.';
  }
}
