/**
 * AI Analysis Service
 * 
 * Analyzes book content and generates intelligent suggestions for planning components
 * including brainstorming notes, characters, plot points, locations, etc.
 */

import { prisma } from '@/lib/db';
import { aiEmbeddingService } from './ai-embedding.service';
import { llmService } from './llm.service';
import type { PlotPointType } from '@prisma/client';

export interface BrainstormingSuggestion {
  id: string;
  title: string;
  content: string;
  reasoning: string;
  tags: string[];
  confidence: number;
  relatedChapters: string[];
}

export interface CharacterSuggestion {
  id: string;
  name: string;
  description: string;
  role: string;
  traits: string[];
  backstory: string;
  reasoning: string;
  confidence: number;
  relatedChapters: string[];
}

export interface LocationSuggestion {
  id: string;
  name: string;
  description: string;
  geography?: string;
  culture?: string;
  rules?: string;
  reasoning: string;
  confidence: number;
  relatedChapters: string[];
}

export interface TimelineEventSuggestion {
  id: string;
  title: string;
  description: string;
  eventDate?: string; // In-story date/time
  eventType: 'historical' | 'personal' | 'world_event' | 'plot_event';
  impact: string;
  reasoning: string;
  confidence: number;
  relatedCharacters: string[];
  relatedLocations: string[];
  relatedChapters: string[];
}

export interface SceneCardSuggestion {
  id: string;
  title: string;
  description: string;
  purpose: string;
  conflict: string;
  outcome: string;
  pov?: string; // Point of view character
  setting?: string; // Location description
  reasoning: string;
  confidence: number;
  relatedChapters: string[];
}

export interface CrossModuleEntities {
  characters: CharacterSuggestion[];
  locations: LocationSuggestion[];
}

export interface ComprehensiveAnalysisResult {
  timeline: TimelineEventSuggestion[];
  characters: CharacterSuggestion[];
  locations: LocationSuggestion[];
  plotPoints: PlotSuggestion[];
  sceneCards: SceneCardSuggestion[];
  brainstorming: BrainstormingSuggestion[];
}

export interface PlotSuggestion {
  id: string;
  type: 'HOOK' | 'PLOT_TURN_1' | 'PINCH_1' | 'MIDPOINT' | 'PINCH_2' | 'PLOT_TURN_2' | 'RESOLUTION';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  subplot: string;
  relatedChapters: string[];
  consistencyIssues?: ConsistencyIssue[];
  relatedEntities?: CrossModuleEntities; // NEW: Cross-module suggestions
}

export interface ConsistencyIssue {
  type: 'timeline' | 'character_state' | 'world_building' | 'logic';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedPlotPoint: {
    id: string;
    subplot: string;
    type: string;
    title: string;
  };
  suggestedFix: {
    newTitle?: string;
    newDescription?: string;
    reasoning: string;
  };
}

export interface PlotAnalysis {
  completeness: {
    mainPlot: {
      total: number;
      completed: number;
      existing: number;
      missing: string[];
    };
    subplots: Array<{
      name: string;
      total: number;
      completed: number;
      existing: number;
    }>;
  };
  recommendations: string[];
}

export interface AnalysisResult {
  brainstormingSuggestions: BrainstormingSuggestion[];
  characterSuggestions: CharacterSuggestion[];
  analysisMetadata: {
    totalChapters: number;
    totalWords: number;
    analysisDate: Date;
    processingTimeMs: number;
  };
}

export class AIAnalysisService {
  
  constructor() {
    // Log which LLM service we're using
    const serviceInfo = llmService.getServiceInfo();
    console.log(`🤖 AIAnalysisService: Using ${serviceInfo.isLocal ? 'Ollama' : 'OpenAI'} (${serviceInfo.defaultModel})`);
  }

  /**
   * Analyze entire book content and generate suggestions
   */
  async analyzeBook(bookId: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting AI analysis for book ${bookId}`);

      // Get book and chapter data
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        include: {
          chapters: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              title: true,
              content: true,
              wordCount: true,
              orderIndex: true
            }
          }
        }
      });

      if (!book) {
        throw new Error(`Book ${bookId} not found`);
      }

      // Calculate total words
      const totalWords = book.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

      // Generate suggestions in parallel
      const [brainstormingSuggestions, characterSuggestions] = await Promise.all([
        this.generateBrainstormingSuggestions(book.chapters, bookId),
        this.generateCharacterSuggestions(book.chapters, bookId)
      ]);

      const processingTimeMs = Date.now() - startTime;

      console.log(`AI analysis completed in ${processingTimeMs}ms`);

      return {
        brainstormingSuggestions,
        characterSuggestions,
        analysisMetadata: {
          totalChapters: book.chapters.length,
          totalWords,
          analysisDate: new Date(),
          processingTimeMs
        }
      };
    } catch (error) {
      console.error('Error analyzing book:', error);
      throw error;
    }
  }

  /**
   * Generate brainstorming suggestions based on chapter content
   */
  async generateBrainstormingSuggestions(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string
  ): Promise<BrainstormingSuggestion[]> {
    try {
      if (chapters.length === 0) {
        return [];
      }

      // Combine chapter content for analysis (limit to avoid token overflow)
      const combinedContent = chapters
        .map(chapter => `Chapter ${chapter.orderIndex}: ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .slice(0, 12000); // Limit content length

      // Get existing brainstorming notes to avoid duplicates
      const existingNotes = await prisma.brainstormingNote.findMany({
        where: { bookId },
        select: { title: true, content: true }
      });

      const existingTopics = existingNotes.map(note => note.title).join(', ');

      const prompt = `
        Analyze this book content and suggest 5 new brainstorming topics that would help the author develop their story further.

        Book Content:
        ${combinedContent}

        Existing Brainstorming Topics (avoid duplicating these):
        ${existingTopics || 'None yet'}

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

        Return as JSON array with this exact structure:
        [
          {
            "title": "Title Here",
            "content": "Detailed brainstorming content here...",
            "reasoning": "Why this brainstorming topic would be valuable...",
            "tags": ["tag1", "tag2", "tag3"],
            "confidence": 0.85
          }
        ]
      `;

      // Get userId from bookId for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          system_prompt: "You are an expert story development consultant. Analyze book content and suggest brainstorming topics that will help authors improve their stories.",
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4o-mini', // Use default model in dev
          // Don't set temperature - use user's default temperature
          max_tokens: 8000, // Increased from 2000 - comprehensive analysis needs longer responses (GPT-4 Turbo: 128K context)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'default', // Use default temperature for general analysis
        }
      );

      const responseContent = response.content;
      if (!responseContent) {
        throw new Error('No response from LLM');
      }

      // Parse JSON response - handle markdown code blocks
      let suggestions: any[];
      try {
        // Strip markdown code blocks if present
        let jsonContent = responseContent.trim();
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
        }
        
        suggestions = JSON.parse(jsonContent);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (parseError: any) {
        console.error('Failed to parse OpenAI response:', responseContent);
        throw new Error('Failed to parse AI response');
      }

      // Convert to our format with IDs
      return suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `brainstorm_${Date.now()}_${index}`,
        title: suggestion.title || 'Untitled Brainstorming Topic',
        content: suggestion.content || 'No content provided',
        reasoning: suggestion.reasoning || 'AI suggested this topic',
        tags: Array.isArray(suggestion.tags) ? suggestion.tags : ['ai-generated'],
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5,
        relatedChapters: chapters.map(c => c.id) // All chapters considered
      }));

    } catch (error) {
      console.error('Error generating brainstorming suggestions:', error);
      return [];
    }
  }

  /**
   * Generate character suggestions based on chapter content
   */
  async generateCharacterSuggestions(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string
  ): Promise<CharacterSuggestion[]> {
    try {
      if (chapters.length === 0) {
        return [];
      }

      // Combine chapter content for analysis
      const combinedContent = chapters
        .map(chapter => `Chapter ${chapter.orderIndex}: ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .slice(0, 12000);

      // Get existing characters to avoid duplicates
      const existingCharacters = await prisma.character.findMany({
        where: { bookId },
        select: { name: true, description: true }
      });

      const existingNames = existingCharacters.map(char => char.name).join(', ');

      const prompt = `
        Analyze this book content and identify 3-5 characters that are mentioned or implied but not yet fully developed as character profiles.

        Book Content:
        ${combinedContent}

        Existing Characters (avoid duplicating these):
        ${existingNames || 'None yet'}

        For each character suggestion, provide:
        1. Character name
        2. Detailed description
        3. Suggested role (PROTAGONIST, ANTAGONIST, MAJOR, MINOR)
        4. Key personality traits
        5. Brief backstory
        6. Reasoning for why this character should be developed
        7. Confidence score (0.0-1.0)

        Return as JSON array with this exact structure:
        [
          {
            "name": "Character Name",
            "description": "Physical and general description...",
            "role": "MAJOR",
            "traits": ["trait1", "trait2", "trait3"],
            "backstory": "Brief backstory...",
            "reasoning": "Why this character needs development...",
            "confidence": 0.8
          }
        ]
      `;

      // Get userId from bookId for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          system_prompt: "You are an expert character development consultant. Extract and suggest character profiles from story content.",
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4o-mini', // Use default model in dev
          // Don't set temperature - use user's suggestions temperature (creative)
          max_tokens: 8000, // Increased from 1500 - character suggestions can be detailed (GPT-4 Turbo: 128K context)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'suggestions', // Use suggestions temperature for creative character ideas
        }
      );

      const responseContent = response.content;
      if (!responseContent) {
        return [];
      }

      // Parse JSON response
      let suggestions: any[];
      try {
        // Clean the response content
        let jsonContent = responseContent.trim();
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
        }
        
        // More comprehensive JSON cleanup
        jsonContent = jsonContent
          .replace(/,(\s*[}\]])/g, '$1')       // Remove trailing commas before } or ]
          .replace(/[\u0000-\u0019]+/g, '')    // Remove control characters
          .trim();
        
        suggestions = JSON.parse(jsonContent);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (parseError: any) {
        console.error('Failed to parse character suggestions:', responseContent);
        return [];
      }

      // Convert to our format with IDs
      return suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `character_${Date.now()}_${index}`,
        name: suggestion.name || 'Unnamed Character',
        description: suggestion.description || 'No description provided',
        role: suggestion.role || 'MINOR',
        traits: Array.isArray(suggestion.traits) ? suggestion.traits : [],
        backstory: suggestion.backstory || 'No backstory provided',
        reasoning: suggestion.reasoning || 'AI identified this character',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5,
        relatedChapters: chapters.map(c => c.id)
      }));

    } catch (error) {
      console.error('Error generating character suggestions:', error);
      return [];
    }
  }

  /**
   * Generate plot structure suggestions based on chapter content and existing plot points
   */
  async generatePlotSuggestions(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string,
    subplot: string = 'main'
  ): Promise<PlotSuggestion[]> {
    try {
      if (chapters.length === 0) {
        return [];
      }

      // Combine chapter content for analysis
      const combinedContent = chapters
        .map(chapter => `Chapter ${chapter.orderIndex}: ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .slice(0, 12000);

      // Get ALL existing plot points for consistency checking
      const allPlotPoints = await prisma.plotPoint.findMany({
        where: { bookId },
        select: { 
          id: true, 
          type: true, 
          title: true, 
          description: true, 
          completed: true, 
          subplot: true 
        }
      });

      // Filter for current subplot for analysis
      const existingPlotPoints = allPlotPoints.filter(point => point.subplot === subplot);

      const plotPointTypes: PlotPointType[] = ['HOOK', 'PLOT_TURN_1', 'PINCH_1', 'MIDPOINT', 'PINCH_2', 'PLOT_TURN_2', 'RESOLUTION'];
      const plotPointDescriptions: Record<PlotPointType, string> = {
        'HOOK': 'Hero in opposite state to their end state',
        'PLOT_TURN_1': 'Hero\'s world changes from status quo', 
        'PINCH_1': 'Something goes wrong, forces hero into action',
        'MIDPOINT': 'Hero shifts from reaction to action',
        'PINCH_2': 'Something fails, seems hopeless',
        'PLOT_TURN_2': 'Hero gets final thing needed to resolve conflict',
        'RESOLUTION': 'Hero follows through, story concludes'
      };

      const existingTypes = existingPlotPoints.map(point => point.type);
      const missingTypes = plotPointTypes.filter(type => !existingTypes.includes(type));
      const existingInfo = existingPlotPoints.map(point => 
        `ID: ${point.id}, ${point.type}: ${point.title} - ${point.description || 'No description'} (${point.completed ? 'Complete' : 'Incomplete'})`
      ).join('\n');

      // Analyze existing plot points to see which ones need improvement
      const plotPointsNeedingWork = existingPlotPoints.filter(point => {
        // Consider a plot point as needing work if:
        // 1. It has no description or very short description
        // 2. It has a generic/default title
        // 3. It's not marked as completed
        const hasMinimalDescription = !point.description || point.description.length < 20;
        const hasGenericTitle = !point.title || 
          point.title.includes('Untitled') || 
          point.title === plotPointDescriptions[point.type] ||
          point.title.length < 10;
        const isNotCompleted = !point.completed;
        
        return hasMinimalDescription || hasGenericTitle || isNotCompleted;
      });

      // If no missing types and no plot points need work, return empty array
      if (missingTypes.length === 0 && plotPointsNeedingWork.length === 0) {
        console.log(`No plot point improvements needed for ${subplot} subplot - all plot points are well-developed`);
        return [];
      }

      const targetTypes = missingTypes.length > 0 
        ? missingTypes 
        : plotPointsNeedingWork.map(p => p.type);
      
      const improvementContext = plotPointsNeedingWork.map(point => 
        `ID: ${point.id}, ${point.type}: Current="${point.title}" - ${point.description || 'No description'} (Needs improvement)`
      ).join('\n');

      // Group all plot points by subplot for consistency analysis
      const allSubplotContext = [...new Set(allPlotPoints.map(p => p.subplot))]
        .map(subplotName => {
          const subplotPoints = allPlotPoints.filter(p => p.subplot === subplotName);
          const pointsList = subplotPoints.map(p => 
            `  ID: ${p.id}, ${p.type}: "${p.title}" - ${p.description || 'No description'} (${p.completed ? 'Complete' : 'Incomplete'})`
          ).join('\n');
          return `${subplotName} Subplot:\n${pointsList}`;
        }).join('\n\n');

      // Get existing characters and locations for cross-module analysis
      const existingCharacters = await prisma.character.findMany({
        where: { bookId },
        select: { name: true, description: true, role: true }
      });

      const existingLocations = await prisma.location.findMany({
        where: { bookId },
        select: { name: true, description: true }
      });

      const characterNames = existingCharacters.map(c => c.name).join(', ');
      const locationNames = existingLocations.map(l => l.name).join(', ');

      const prompt = `
        Analyze this book content and suggest plot points for the 7-point story structure with FULL CONSISTENCY CHECKING AND CROSS-MODULE ENTITY DETECTION.
        
        Book Content:
        ${combinedContent}

        ALL EXISTING PLOT POINTS (for consistency analysis):
        ${allSubplotContext}

        EXISTING CHARACTERS: ${characterNames || 'None yet'}
        EXISTING LOCATIONS: ${locationNames || 'None yet'}

        CURRENT FOCUS - "${subplot}" subplot:
        ${existingInfo || 'No existing plot points'}

        ${missingTypes.length > 0 
          ? `MISSING TYPES: Create new plot points for these missing types: ${missingTypes.join(', ')}`
          : `IMPROVEMENT NEEDED: Improve these existing plot points:\n${improvementContext}`
        }

        7-Point Story Structure Definitions:
        ${targetTypes.map(type => `${type}: ${plotPointDescriptions[type]}`).join('\n')}

        CRITICAL REQUIREMENTS:
        1. ${missingTypes.length > 0 
          ? `ONLY suggest plot points for missing types: ${missingTypes.join(', ')}`
          : `Improve these types: ${targetTypes.join(', ')}`
        }
        2. Clearly evident in or strongly implied by the story content
        3. Fit the 7-point structure definitions above
        4. Advance the ${subplot} storyline
        5. **MUST BE CONSISTENT** with ALL existing plot points from ALL subplots
        6. **IDENTIFY ANY CONTRADICTIONS** with existing plot points and provide specific fixes
        7. **DETECT NEW ENTITIES** that would need to be created for this plot point

        For each suggestion, analyze consistency with ALL existing plot points and identify:
        - Timeline conflicts (events happening in wrong order)
        - Character state conflicts (character traits/abilities contradicting)
        - World-building conflicts (rules, settings, lore contradictions)
        - Logic conflicts (cause-and-effect contradictions)

        CROSS-MODULE ENTITY DETECTION:
        For each plot suggestion, identify any NEW entities that would need to be created:
        - NEW CHARACTERS: Any person, being, or entity mentioned that is NOT in existing characters list
        - NEW LOCATIONS: Any place, setting, or environment that is NOT in existing locations list
        Provide detailed suggestions for these entities if they are central to the plot point.

        Return a JSON array of plot suggestions with this exact structure:
        [
          {
            "type": "HOOK|PLOT_TURN_1|PINCH_1|MIDPOINT|PINCH_2|PLOT_TURN_2|RESOLUTION",
            "title": "Clear, specific title for this plot point",
            "description": "Detailed description of what happens in this plot point, referencing specific story elements",
            "reasoning": "Why this plot point fits the story structure and advances the ${subplot} plot",
            "confidence": 0.0-1.0,
            "subplot": "${subplot}",
            "relatedChapters": ["chapter_content_references"],
            "consistencyIssues": [
              {
                "type": "timeline|character_state|world_building|logic",
                "severity": "high|medium|low",
                "description": "Clear explanation of the contradiction",
                "affectedPlotPoint": {
                  "id": "exact_database_id_from_above_list",
                  "subplot": "affected_subplot_name",
                  "type": "PLOT_POINT_TYPE",
                  "title": "Current title of conflicting plot point"
                },
                "suggestedFix": {
                  "newTitle": "Optional new title to resolve conflict",
                  "newDescription": "Optional new description to resolve conflict",
                  "reasoning": "Why this fix resolves the contradiction"
                }
              }
            ],
            "relatedEntities": {
              "characters": [
                {
                  "name": "Character Name",
                  "description": "Brief description of the character",
                  "role": "PROTAGONIST|ANTAGONIST|MAJOR|MINOR|CAMEO",
                  "traits": ["trait1", "trait2"],
                  "backstory": "Brief backstory if relevant",
                  "reasoning": "Why this character is needed for this plot point",
                  "confidence": 0.0-1.0
                }
              ],
              "locations": [
                {
                  "name": "Location Name", 
                  "description": "Description of the location",
                  "geography": "Physical characteristics if relevant",
                  "culture": "Cultural aspects if relevant", 
                  "reasoning": "Why this location is needed for this plot point",
                  "confidence": 0.0-1.0
                }
              ]
            }
          }
        ]

        IMPORTANT: Include "consistencyIssues" array for EVERY suggestion (empty array [] if no issues).
        IMPORTANT: Include "relatedEntities" object for EVERY suggestion with "characters" and "locations" arrays (empty arrays [] if none).
        CRITICAL: Use the EXACT database IDs (like "cmh...9kccz8zp45o2") from the plot points listed above.
        DO NOT make up IDs or use descriptive strings - use only the exact "ID: xxx" values provided.
        Only suggest characters/locations that are NOT in the existing lists above.
        Ensure the JSON is valid and parseable.
      `;

      // Get userId from bookId for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4o-mini', // Use default model in dev
          max_tokens: 8000, // Increased from 2000 - plot suggestions can be comprehensive (GPT-4 Turbo: 128K context)
          // Don't set temperature - use user's suggestions temperature (creative)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'suggestions', // Use suggestions temperature for creative plot suggestions
        }
      );

      const responseContent = response.content;
      if (!responseContent) {
        throw new Error('No response from LLM');
      }

      // Parse JSON response - handle markdown code blocks
      let suggestions: any[];
      
      // Strip markdown code blocks if present
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
      }
      
      // More comprehensive JSON cleanup - only remove problematic trailing commas
      jsonContent = jsonContent
        .replace(/,(\s*[}\]])/g, '$1')       // Remove trailing commas before } or ]
        .replace(/[\u0000-\u0019]+/g, '')    // Remove control characters
        .trim();
      
      try {
        console.log('Attempting to parse JSON:', jsonContent.substring(0, 200) + '...');
        suggestions = JSON.parse(jsonContent);
      } catch (parseError: any) {
        console.error('Failed to parse OpenAI response. Full response:', responseContent);
        console.error('Cleaned JSON content:', jsonContent);
        console.error('Parse error:', parseError.message);
        
        // Try to extract just the array content if it's wrapped in extra text
        const arrayMatch = jsonContent.match(/\[\s*{[\s\S]*}\s*\]/);
        if (arrayMatch) {
          try {
            console.log('Attempting to parse extracted array...');
            suggestions = JSON.parse(arrayMatch[0]);
          } catch (retryError: any) {
            console.error('Retry parse also failed:', retryError.message);
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
        } else {
          throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }
      }

      // Convert to our format with IDs
      return suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `plot_${Date.now()}_${index}`,
        type: suggestion.type || 'HOOK',
        title: suggestion.title || 'Untitled Plot Point',
        description: suggestion.description || 'No description provided',
        reasoning: suggestion.reasoning || 'AI suggested this plot point',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5,
        subplot: suggestion.subplot || subplot,
        relatedChapters: Array.isArray(suggestion.relatedChapters) ? suggestion.relatedChapters : [],
        consistencyIssues: Array.isArray(suggestion.consistencyIssues) ? suggestion.consistencyIssues : []
      }));

    } catch (error) {
      console.error('Error generating plot suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze existing plot points and suggest improvements
   */
  async analyzePlotStructure(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string
  ): Promise<PlotAnalysis> {
    try {
      // Get all existing plot points
      const existingPlotPoints = await prisma.plotPoint.findMany({
        where: { bookId },
        select: { type: true, title: true, description: true, completed: true, subplot: true }
      });

      const plotPointTypes: PlotPointType[] = ['HOOK', 'PLOT_TURN_1', 'PINCH_1', 'MIDPOINT', 'PINCH_2', 'PLOT_TURN_2', 'RESOLUTION'];
      const mainPlot = existingPlotPoints.filter(point => point.subplot === 'main');
      const missingTypes = plotPointTypes.filter(type => !mainPlot.find(point => point.type === type));
      const subplots = [...new Set(existingPlotPoints.map(point => point.subplot).filter(s => s !== 'main'))];

      return {
        completeness: {
          mainPlot: {
            total: plotPointTypes.length,
            completed: mainPlot.filter(point => point.completed).length,
            existing: mainPlot.length,
            missing: missingTypes
          },
          subplots: subplots.map(subplot => {
            const subplotPoints = existingPlotPoints.filter(point => point.subplot === subplot);
            return {
              name: subplot || 'unnamed',
              total: plotPointTypes.length,
              completed: subplotPoints.filter(point => point.completed).length,
              existing: subplotPoints.length
            };
          })
        },
        recommendations: [
          ...missingTypes.map(type => `Add ${type} to main plot`),
          ...(mainPlot.length > 0 && mainPlot.filter(point => !point.completed).length > 0 
            ? [`Complete ${mainPlot.filter(point => !point.completed).length} unfinished plot points`] 
            : []),
          ...(subplots.length === 0 ? ['Consider adding subplots (romance, character arc, etc.)'] : [])
        ]
      };

    } catch (error) {
      console.error('Error analyzing plot structure:', error);
      throw error;
    }
  }

  /**
   * Comprehensive analysis of entire book - generates suggestions for all planning modules
   */
  async comprehensiveAnalysis(bookId: string): Promise<ComprehensiveAnalysisResult> {
    try {
      console.log('Starting comprehensive analysis for book:', bookId);
      
      // Get all book chapters
      const chapters = await prisma.chapter.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          title: true,
          content: true,
          orderIndex: true
        }
      });

      if (chapters.length === 0) {
        return {
          timeline: [],
          characters: [],
          locations: [],
          plotPoints: [],
          sceneCards: [],
          brainstorming: []
        };
      }

      // Run all analyses in parallel for better performance
      const [
        timelineEvents,
        characters,
        locations,
        plotPoints,
        sceneCards,
        brainstormingNotes
      ] = await Promise.all([
        this.generateTimelineEventSuggestions(chapters, bookId),
        this.generateCharacterSuggestions(chapters, bookId),
        this.generateLocationSuggestions(chapters, bookId),
        this.generatePlotSuggestions(chapters, bookId, 'main'), // Analyze main plot
        this.generateSceneCardSuggestions(chapters, bookId),
        this.generateBrainstormingSuggestions(chapters, bookId)
      ]);

      console.log('Comprehensive analysis completed successfully');

      return {
        timeline: timelineEvents,
        characters: characters as CharacterSuggestion[],
        locations: locations,
        plotPoints: plotPoints as PlotSuggestion[],
        sceneCards: sceneCards,
        brainstorming: brainstormingNotes as BrainstormingSuggestion[]
      };

    } catch (error) {
      console.error('Error in comprehensive analysis:', error);
      throw error;
    }
  }

  /**
   * Quick analysis for a specific type
   */
  async quickAnalysis(bookId: string, type: 'brainstorming' | 'characters' | 'plot', subplot?: string): Promise<BrainstormingSuggestion[] | CharacterSuggestion[] | PlotSuggestion[]> {
    try {
      // Get book chapters
      const chapters = await prisma.chapter.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          title: true,
          content: true,
          orderIndex: true
        }
      });

      switch (type) {
        case 'brainstorming':
          return await this.generateBrainstormingSuggestions(chapters, bookId);
        case 'characters':
          return await this.generateCharacterSuggestions(chapters, bookId);
        case 'plot':
          return await this.generatePlotSuggestions(chapters, bookId, subplot || 'main');
        default:
          throw new Error(`Unsupported analysis type: ${type}`);
      }
    } catch (error) {
      console.error(`Error in quick analysis (${type}):`, error);
      throw error;
    }
  }

  /**
   * Generate timeline event suggestions based on chapter content
   */
  async generateTimelineEventSuggestions(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string
  ): Promise<TimelineEventSuggestion[]> {
    try {
      if (chapters.length === 0) {
        return [];
      }

      // Combine chapter content for analysis
      const combinedContent = chapters
        .map(chapter => `Chapter ${chapter.orderIndex}: ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .slice(0, 15000); // Larger for timeline analysis

      // Get existing timeline events to avoid duplicates
      const existingEvents = await prisma.timelineEvent.findMany({
        where: { bookId },
        select: { title: true, description: true }
      });

      const existingTitles = existingEvents.map(event => event.title).join(', ');

      const prompt = `
        Analyze this book content and identify 5-8 key timeline events that form the backbone of the story's chronology.

        Book Content:
        ${combinedContent}

        Existing Timeline Events (avoid duplicating these):
        ${existingTitles || 'None yet'}

        Focus on:
        1. Major plot events that drive the story forward
        2. Historical background events mentioned in the story
        3. Character backstory events that impact the current story
        4. World events that affect the narrative

        For each timeline event, provide:
        1. Clear, descriptive title
        2. Brief description of what happens
        3. Event type (historical, personal, world_event, plot_event)
        4. Impact on the story or characters
        5. Related characters and locations if mentioned
        6. Confidence level (0.0 to 1.0)

        Return a JSON array with this structure:
        [
          {
            "title": "Event Title",
            "description": "What happens in this event",
            "eventDate": "Optional in-story date or timeframe",
            "eventType": "historical|personal|world_event|plot_event",
            "impact": "How this event affects the story or characters",
            "reasoning": "Why this event is important to the timeline",
            "confidence": 0.0-1.0,
            "relatedCharacters": ["character names if mentioned"],
            "relatedLocations": ["location names if mentioned"],
            "relatedChapters": ["chapter references"]
          }
        ]
        
        Ensure the JSON is valid and parseable.
      `;

      // Get userId from bookId for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4o-mini', // Use default model in dev
          max_tokens: 8000, // Increased from 2000/3000 - comprehensive suggestions need longer responses (GPT-4 Turbo: 128K context)
          // Don't set temperature - use user's suggestions temperature (creative)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'suggestions', // Use suggestions temperature for creative timeline/location/scene suggestions
        }
      );

      let suggestions: TimelineEventSuggestion[];
      let responseContent = response.content?.trim() || '';
      
      // Clean JSON response
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
      }
      
      jsonContent = jsonContent
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/[\u0000-\u0019]+/g, '')
        .trim();

      suggestions = JSON.parse(jsonContent);

      // Add unique IDs
      return suggestions.map(suggestion => ({
        ...suggestion,
        id: `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));

    } catch (error) {
      console.error('Error generating timeline suggestions:', error);
      return [];
    }
  }

  /**
   * Generate location suggestions based on chapter content
   */
  async generateLocationSuggestions(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string
  ): Promise<LocationSuggestion[]> {
    try {
      if (chapters.length === 0) {
        return [];
      }

      const combinedContent = chapters
        .map(chapter => `Chapter ${chapter.orderIndex}: ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .slice(0, 15000);

      // Get existing locations to avoid duplicates
      const existingLocations = await prisma.location.findMany({
        where: { bookId },
        select: { name: true, description: true }
      });

      const existingNames = existingLocations.map(loc => loc.name).join(', ');

      const prompt = `
        Analyze this book content and identify 4-6 important locations that should be documented for world-building.

        Book Content:
        ${combinedContent}

        Existing Locations (avoid duplicating these):
        ${existingNames || 'None yet'}

        Focus on:
        1. Settings where key scenes take place
        2. Locations mentioned multiple times
        3. Places with cultural or historical significance
        4. Locations that affect character development or plot

        For each location suggestion, provide:
        1. Clear, specific name
        2. Description of the location
        3. Geographic characteristics if mentioned
        4. Cultural aspects if relevant
        5. Why this location is important to track

        Return a JSON array with this structure:
        [
          {
            "name": "Location Name",
            "description": "Description of what this place is like",
            "geography": "Physical characteristics, climate, etc.",
            "culture": "Cultural aspects, customs, significance",
            "reasoning": "Why this location should be documented",
            "confidence": 0.0-1.0,
            "relatedChapters": ["chapter references"]
          }
        ]
        
        Ensure the JSON is valid and parseable.
      `;

      // Get userId from bookId for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4o-mini', // Use default model in dev
          max_tokens: 8000, // Increased from 2000/3000 - comprehensive suggestions need longer responses (GPT-4 Turbo: 128K context)
          // Don't set temperature - use user's suggestions temperature (creative)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'suggestions', // Use suggestions temperature for creative timeline/location/scene suggestions
        }
      );

      let suggestions: LocationSuggestion[];
      let responseContent = response.content?.trim() || '';
      
      // Clean JSON response
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
      }
      
      jsonContent = jsonContent
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/[\u0000-\u0019]+/g, '')
        .trim();

      suggestions = JSON.parse(jsonContent);

      // Add unique IDs
      return suggestions.map(suggestion => ({
        ...suggestion,
        id: `location-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));

    } catch (error) {
      console.error('Error generating location suggestions:', error);
      return [];
    }
  }

  /**
   * Generate scene card suggestions based on chapter content
   */
  async generateSceneCardSuggestions(
    chapters: Array<{ id: string; title: string; content: string; orderIndex: number }>,
    bookId: string
  ): Promise<SceneCardSuggestion[]> {
    try {
      if (chapters.length === 0) {
        return [];
      }

      const combinedContent = chapters
        .map(chapter => `Chapter ${chapter.orderIndex}: ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .slice(0, 15000);

      // Get existing scene cards to avoid duplicates
      const existingScenes = await prisma.sceneCard.findMany({
        where: { bookId },
        select: { title: true, description: true, purpose: true }
      });

      const existingTitles = existingScenes.map(scene => scene.title).join(', ');

      const prompt = `
        Analyze this book content and identify 6-10 key scenes that would benefit from detailed scene planning.

        Book Content:
        ${combinedContent}

        Existing Scene Cards (avoid duplicating these):
        ${existingTitles || 'None yet'}

        Focus on:
        1. Dramatic or climactic moments
        2. Character development scenes
        3. Plot-advancing scenes
        4. Scenes with complex emotions or conflicts
        5. World-building or exposition scenes

        For each scene suggestion, provide:
        1. Clear, descriptive title
        2. Brief scene description
        3. Scene's purpose in the story
        4. Main conflict or tension
        5. Expected outcome or result
        6. Point of view character if identifiable
        7. Setting description

        Return a JSON array with this structure:
        [
          {
            "title": "Scene Title",
            "description": "Brief description of what happens",
            "purpose": "What this scene accomplishes for the story",
            "conflict": "Main tension or conflict in the scene",
            "outcome": "What changes or is resolved by scene end",
            "pov": "Point of view character name if identifiable",
            "setting": "Where the scene takes place",
            "reasoning": "Why this scene needs detailed planning",
            "confidence": 0.0-1.0,
            "relatedChapters": ["chapter references"]
          }
        ]
        
        Ensure the JSON is valid and parseable.
      `;

      // Get userId from bookId for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4o-mini', // Use default model in dev
          max_tokens: 8000, // Increased from 2000/3000 - comprehensive suggestions need longer responses (GPT-4 Turbo: 128K context)
          // Don't set temperature - use user's suggestions temperature (creative)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'suggestions', // Use suggestions temperature for creative timeline/location/scene suggestions
        }
      );

      let suggestions: SceneCardSuggestion[];
      let responseContent = response.content?.trim() || '';
      
      // Clean JSON response
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
      }
      
      jsonContent = jsonContent
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/[\u0000-\u0019]+/g, '')
        .trim();

      suggestions = JSON.parse(jsonContent);

      // Add unique IDs
      return suggestions.map(suggestion => ({
        ...suggestion,
        id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));

    } catch (error) {
      console.error('Error generating scene card suggestions:', error);
      return [];
    }
  }
}

// Export singleton instance
export const aiAnalysisService = new AIAnalysisService();
