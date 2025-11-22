import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { PlanningContextService } from '../planning-context.service';

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
  // Override with extended signature and different return type
  async analyze(
    chapters: Chapter[], 
    bookId: string, 
    additionalContext?: any
  ): Promise<any> {
    // Extract parameters from additionalContext
    const existingSuggestions = additionalContext?.existingSuggestions as Array<{ title: string; description: string }> | undefined;
    const cachedContext = additionalContext?.cachedContext as string | null | undefined;
    const skipVectorSearch = additionalContext?.skipVectorSearch as boolean | undefined;
    const customIdea = additionalContext?.customIdea as string | undefined;
    console.log('🎬 Scene Agent: Starting analysis...');
    
    // Get existing scene cards
    const existingScenes = await prisma.sceneCard.findMany({
      where: { bookId },
      select: { title: true, description: true, purpose: true, conflict: true, outcome: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    let planningContext: string;

    // 💰 OPTIMIZATION: Use cached planning data if available
    if (skipVectorSearch && cachedContext) {
      console.log('🎬 ⚡ Using CACHED planning context - skipping database fetch to save time!');
      planningContext = cachedContext;
    } else {
      console.log('🎬 📚 Fetching comprehensive planning data from database...');
      // Fetch all planning data directly from database using shared service
      planningContext = await PlanningContextService.buildPlanningContext(bookId);
    }
    
    // Build DETAILED existing scenes context to avoid duplicates
    // Include both saved scenes AND suggestions from current session
    const allExisting = [
      ...existingScenes.map(scene => ({ title: scene.title || 'Untitled', description: scene.description || '', purpose: scene.purpose })),
      ...(existingSuggestions || []).map(s => ({ title: s.title, description: s.description, purpose: '' }))
    ];
    
    const existingScenesList = allExisting.length > 0 
      ? allExisting.map((scene, i) => `${i + 1}. ${scene.title}: ${scene.description.substring(0, 100)}${scene.description.length > 100 ? '...' : ''}`).join('\n')
      : 'None yet';

    const prompt = `
      Analyze this book content and suggest NEW scene cards for important scenes that need detailed planning.

      COMPREHENSIVE BOOK PLANNING DATA:
      ${planningContext}

      EXISTING SCENE CARDS (DO NOT DUPLICATE):
      ${existingScenesList}

      ${customIdea ? `CUSTOM SCENE IDEA:\n${customIdea}\n\nUse this idea as the basis for scene suggestions.` : ''}

      CRITICAL REQUIREMENTS:
      1. **AVOID ALL DUPLICATES**: Carefully review existing scene cards above. Do NOT suggest anything similar in title, description, or purpose
      2. **USE ALL AVAILABLE CONTEXT**: Leverage plots, timeline, characters, locations, brainstorming ideas to identify key scenes that need planning
      3. **FILL SCENE GAPS**: Identify dramatic moments, character interactions, or plot developments that need detailed planning
      4. **BE SPECIFIC**: Reference actual content from the book (character names, locations, plot events)
      5. **HIGH CONFIDENCE**: Base suggestions on actual book content (0.7-0.9 confidence)

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
      const response = await this.callOpenAI(prompt, bookId);
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
      return {
        suggestions: sceneSuggestions,
        context: planningContext // Return planning context for caching
      };
    } catch (error) {
      console.error('Scene Agent error:', error);
      return {
        suggestions: [],
        context: planningContext || ''
      };
    }
  }
}
