import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { aiEmbeddingService } from '../ai-embedding.service';

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
  async analyze(chapters: Chapter[], bookId: string): Promise<CharacterSuggestion[]> {
    console.log('👤 Character Agent: Starting analysis...');
    
    // Generate search query for character-related content
    const searchQuery = `character development personality traits backstory relationships character arc motivation`;
    
    // Use comprehensive vector search to find ALL relevant content - FULL CONTEXT ACCESS
    const relevantNotes = await aiEmbeddingService.findSimilarBrainstormingNotes(bookId, searchQuery, 100);
    
    // Create focused content summary from vector search results
    const relevantContent = this.buildRelevantContentSummary(chapters, relevantNotes);
    
    // Get book details and existing characters
    const [book, existingCharacters] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.character.findMany({
        where: { bookId },
        select: { name: true, description: true, role: true }
      })
    ]);

    // Simple list of existing characters for AI to avoid
    const existingCharactersList = existingCharacters.length > 0 
      ? existingCharacters.map(char => `(${char.name}, ${char.description?.substring(0, 100) || 'No description'}...)`).join(', ')
      : 'None yet';

    const prompt = `
      Analyze this book and suggest NEW characters that would enhance the story.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      RELEVANT CONTENT (from vector similarity search):
      ${relevantContent}

      These are the current characters, do not make suggestions based on these, create new characters.
      Current characters: [${existingCharactersList}]

      CRITICAL REQUIREMENTS:
      1. **CREATE COMPLETELY NEW CHARACTERS**: Do not suggest anything similar to the existing characters listed above
      2. **USE BOOK TITLE & DESCRIPTION AS PRIMARY SOURCE**: Base character suggestions on the book's title, description, and genre
      3. Focus on characters that are mentioned or implied but not yet fully developed
      4. Consider characters needed for plot development
      5. Ensure each character serves a specific narrative purpose
      6. **HIGH CONFIDENCE FOR BOOK-BASED SUGGESTIONS**: If suggestions are based on clear book concept, confidence should be 0.8-0.9

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
      return characterSuggestions;
    } catch (error) {
      console.error('Character Agent error:', error);
      return [];
    }
  }

  /**
   * Filter out duplicate character suggestions using vector similarity
   */
  private async filterDuplicateCharacters(suggestions: CharacterSuggestion[], bookId: string): Promise<CharacterSuggestion[]> {
    try {
      const filteredSuggestions: CharacterSuggestion[] = [];
      
      for (const suggestion of suggestions) {
        // Create search query from character details
        const characterQuery = `${suggestion.name} ${suggestion.description} ${suggestion.role} ${suggestion.traits.join(' ')}`;
        
        // Find similar existing characters using vector search
        const similarCharacters = await aiEmbeddingService.findSimilarCharacters(bookId, characterQuery, 5);
        
        // Check if any existing character is too similar (similarity > 0.8 means likely duplicate)
        const isDuplicate = similarCharacters.some(existing => {
          // Name similarity check
          const nameSimilar = this.areStringsSimilar(suggestion.name, existing.name);
          
          // High vector similarity indicates conceptual duplicate
          const highSimilarity = existing.similarity && existing.similarity > 0.8;
          
          return nameSimilar || highSimilarity;
        });
        
        if (!isDuplicate) {
          filteredSuggestions.push(suggestion);
        } else {
          console.log(`🚫 Character Agent: Filtered out duplicate suggestion "${suggestion.name}"`);
        }
      }
      
      return filteredSuggestions;
    } catch (error) {
      console.error('Error filtering duplicate characters:', error);
      // Return original suggestions if filtering fails
      return suggestions;
    }
  }

  /**
   * Check if two strings are similar (handles variations like "John" vs "Johnny")
   */
  private areStringsSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return true;
    
    // Check if one is contained in the other (handles "John" vs "Johnny")
    if (s1.includes(s2) || s2.includes(s1)) return true;
    
    // Simple Levenshtein-like similarity
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return true;
    
    let matches = 0;
    const minLen = Math.min(s1.length, s2.length);
    
    for (let i = 0; i < minLen; i++) {
      if (s1[i] === s2[i]) matches++;
    }
    
    const similarity = matches / maxLen;
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
