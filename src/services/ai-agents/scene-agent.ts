import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { aiEmbeddingService } from '../ai-embedding.service';

export interface SceneCardSuggestion {
  id: string;
  title: string;
  description: string;
  purpose?: string;
  conflict?: string;
  outcome?: string;
  reasoning: string;
  confidence: number;
}

export class SceneAgent extends AIAgent {
  async analyze(chapters: Chapter[], bookId: string): Promise<SceneCardSuggestion[]> {
    console.log('🎬 Scene Agent: Starting analysis...');
    
    // Generate search query for scene-related content
    const searchQuery = `scene structure dramatic beats conflict resolution story beats scene purpose`;
    
    // Use comprehensive vector search to find ALL relevant content - FULL CONTEXT ACCESS
    const relevantNotes = await aiEmbeddingService.findSimilarBrainstormingNotes(bookId, searchQuery, 100);
    
    // Create focused content summary from vector search results
    const relevantContent = this.buildRelevantContentSummary(chapters, relevantNotes);
    
    // Get existing scene cards to avoid duplicates
    const existingScenes = await prisma.sceneCard.findMany({
      where: { bookId },
      select: { title: true, description: true, purpose: true }
    });

    // Simple list of existing scenes for AI to avoid
    const existingScenesList = existingScenes.length > 0 
      ? existingScenes.map(scene => `(${scene.title}, ${scene.description?.substring(0, 100) || 'No description'}...)`).join(', ')
      : 'None yet';

    const prompt = `
      Analyze this book content and suggest NEW scene cards for important scenes that need detailed planning.

      RELEVANT CONTENT (from vector similarity search):
      ${relevantContent}

      These are the current scene cards, do not make suggestions based on these, create new scenes.
      Current scene cards: [${existingScenesList}]

      CRITICAL REQUIREMENTS:
      1. **CREATE COMPLETELY NEW SCENES**: Do not suggest anything similar to the existing scene cards listed above
      2. Focus on scenes that are mentioned or implied but need detailed planning
      3. Consider key dramatic moments, character interactions, and plot developments
      4. Ensure each scene serves a specific narrative purpose

      For each scene card suggestion, provide:
      1. A clear, compelling scene title
      2. Detailed description of what happens in the scene
      3. The scene's purpose in the overall story
      4. Main conflict or tension in the scene
      5. Outcome or resolution of the scene
      6. Reasoning for why this scene needs detailed planning
      7. Confidence score (0.0-1.0)

      Focus on scenes that:
      - Contain major character developments or revelations
      - Feature important plot turning points
      - Include significant conflicts or confrontations
      - Introduce key characters or locations
      - Require careful pacing or choreography
      - Have complex emotional or thematic weight

      Scene Planning Elements:
      - Purpose: Why this scene exists in the story
      - Conflict: What tension or obstacle drives the scene
      - Outcome: How the scene changes the story or characters

      Return a JSON array with this exact structure:
      [
        {
          "title": "Scene Title",
          "description": "Detailed description of what happens in the scene",
          "purpose": "The scene's purpose in the overall story",
          "conflict": "Main conflict or tension in the scene",
          "outcome": "Outcome or resolution of the scene",
          "reasoning": "Why this scene needs detailed planning",
          "confidence": 0.85
        }
      ]

      Limit to 5 most important scene suggestions.
      Ensure the JSON is valid and parseable.
    `;

    try {
      const response = await this.callOpenAI(prompt);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs
      const sceneSuggestions: SceneCardSuggestion[] = suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `scene_${Date.now()}_${index}`,
        title: suggestion.title || 'Untitled Scene',
        description: suggestion.description || 'No description provided',
        purpose: suggestion.purpose || '',
        conflict: suggestion.conflict || '',
        outcome: suggestion.outcome || '',
        reasoning: suggestion.reasoning || '',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5
      }));

      console.log(`🎬 Scene Agent: Generated ${sceneSuggestions.length} suggestions`);
      return sceneSuggestions;
    } catch (error) {
      console.error('Scene Agent error:', error);
      return [];
    }
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
