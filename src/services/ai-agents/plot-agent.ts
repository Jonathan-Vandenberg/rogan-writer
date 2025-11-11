import { Chapter, PlotPointType } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { PlanningContextService } from '../planning-context.service';

export interface ConsistencyIssue {
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedPlotPoint: {
    id: string;
    type: string;
    title: string;
  };
  suggestedFix: string;
}

export interface PlotSuggestion {
  id: string;
  type: PlotPointType;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  subplot: string;
  relatedChapters: string[];
  consistencyIssues?: ConsistencyIssue[];
}

export class PlotAgent extends AIAgent {
  async analyze(chapters: Chapter[], bookId: string, subplot: string = 'main'): Promise<PlotSuggestion[]> {
    console.log(`🎭 Plot Agent: Analyzing subplot "${subplot}"...`);
    
    // Note: Vector search removed - using planning context instead
    const relevantContent = '';

    // Get existing plot points for this subplot and all subplots (for consistency checking)
    const [existingPlotPoints, allPlotPoints] = await Promise.all([
      prisma.plotPoint.findMany({
        where: { bookId, subplot },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.plotPoint.findMany({
        where: { bookId },
        orderBy: [{ subplot: 'asc' }, { orderIndex: 'asc' }]
      })
    ]);

    // Determine which plot point types are missing or need improvement
    const plotPointTypes: PlotPointType[] = ['HOOK', 'PLOT_TURN_1', 'PINCH_1', 'MIDPOINT', 'PINCH_2', 'PLOT_TURN_2', 'RESOLUTION'];
    const existingTypes = new Set(existingPlotPoints.map(pp => pp.type));
    const missingTypes = plotPointTypes.filter(type => !existingTypes.has(type));
    
    // Find plot points that need improvement (short descriptions, generic titles, not completed)
    const plotPointsNeedingWork = existingPlotPoints.filter(pp => 
      (pp.description && pp.description.length < 50) || 
      pp.title.includes('Plot Point') || 
      !pp.completed
    );

    // If no missing types and no work needed, return empty
    if (missingTypes.length === 0 && plotPointsNeedingWork.length === 0) {
      console.log(`🎭 Plot Agent: No improvements needed for subplot "${subplot}"`);
      return [];
    }

    // Get book details, character and location names for context
    const [book, characters, locations] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true, targetWords: true }
      }),
      prisma.character.findMany({
        where: { bookId },
        select: { name: true }
      }),
      prisma.location.findMany({
        where: { bookId },
        select: { name: true }
      })
    ]);

    const characterNames = characters.map(c => c.name).join(', ');
    const locationNames = locations.map(l => l.name).join(', ');

    // Simple lists of existing content for AI context
    const existingPlotPointsList = existingPlotPoints.length > 0 
      ? existingPlotPoints.map(pp => `(${pp.type}: ${pp.title}, ${pp.description || 'No description'})`).join(', ')
      : 'None yet';

    const allSubplotsList = allPlotPoints.length > 0 
      ? allPlotPoints.map(pp => `(${pp.subplot} ${pp.type}: ${pp.title}, ${pp.description || 'No description'})`).join(', ')
      : 'None yet';

    const prompt = `
      Analyze this book and suggest plot points for the 7-point story structure with FULL CONSISTENCY CHECKING.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}
      Target Length: ${book?.targetWords || 'Not specified'} words

      RELEVANT CONTENT (from vector similarity search):
      ${relevantContent}

      Target Subplot: ${subplot}

      These are the current plot points for "${subplot}" subplot, consider these when making suggestions.
      Current plot points for ${subplot}: [${existingPlotPointsList}]

      These are ALL plot points across all subplots, ensure consistency with these.
      All existing plot points: [${allSubplotsList}]

      Current characters: [${characterNames || 'None yet'}]
      Current locations: [${locationNames || 'None yet'}]

      MISSING TYPES to suggest: ${missingTypes.join(', ') || 'None'}
      PLOT POINTS NEEDING IMPROVEMENT: ${plotPointsNeedingWork.map(pp => pp.type).join(', ') || 'None'}

      7-Point Story Structure:
      1. HOOK - Opening that grabs attention
      2. PLOT_TURN_1 - Inciting incident that starts the story
      3. PINCH_1 - First major obstacle/complication
      4. MIDPOINT - Major revelation or turning point
      5. PINCH_2 - Darkest moment, all hope seems lost
      6. PLOT_TURN_2 - Final piece falls into place
      7. RESOLUTION - Climax and resolution

      CRITICAL REQUIREMENTS:
      1. **USE BOOK TITLE & DESCRIPTION AS PRIMARY SOURCE**: Even if no chapters are written yet, base plot suggestions on the book's title, description, and genre. These provide the core story concept.
      2. **ONLY suggest for missing types OR plot points needing improvement**
      3. **FULL CONSISTENCY CHECK**: Compare against ALL existing plot points across ALL subplots
      4. **DETECT CONTRADICTIONS**: Look for timeline conflicts, character state conflicts, world-building conflicts, logic conflicts
      5. **USE ACTUAL DATABASE IDs**: When referencing existing plot points for fixes, use the exact database ID provided above
      6. **SUGGEST SPECIFIC FIXES**: For any consistency issues, provide exact text suggestions for affected plot points
      7. **HIGH CONFIDENCE FOR BOOK-BASED SUGGESTIONS**: If suggestions are based on clear book title/description, confidence should be 0.8-0.9

      CONSISTENCY CHECK TYPES:
      - Timeline contradictions (events out of order)
      - Character state conflicts (character development inconsistencies)
      - World-building conflicts (setting, rules, magic systems)
      - Logic conflicts (cause and effect issues)

      IMPORTANT: If there are no chapters written yet but the book has a clear title and description, create plot suggestions that directly support that story concept. Do NOT generate generic "Empty World" or "Undefined" suggestions. Extract meaning from the book's title and description to create compelling, specific plot points.

      Return a JSON array of plot suggestions with this exact structure:
      [
        {
          "type": "HOOK|PLOT_TURN_1|PINCH_1|MIDPOINT|PINCH_2|PLOT_TURN_2|RESOLUTION",
          "title": "Compelling plot point title",
          "description": "Detailed description of what happens",
          "reasoning": "Why this plot point is needed and how it fits",
          "confidence": 0.85,
          "subplot": "${subplot}",
          "relatedChapters": ["chapter1", "chapter2"],
          "consistencyIssues": [
            {
              "severity": "high|medium|low",
              "description": "What the inconsistency is",
              "affectedPlotPoint": {
                "id": "exact_database_id_here",
                "type": "HOOK",
                "title": "Existing plot point title"
              },
              "suggestedFix": "Exact text suggestion to fix the inconsistency"
            }
          ]
        }
      ]

      Only suggest plot points for missing types or those needing improvement.
      Use exact database IDs when referencing existing plot points.
      Ensure the JSON is valid and parseable.
    `;

    try {
      const response = await this.callOpenAI(prompt);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs
      const plotSuggestions: PlotSuggestion[] = suggestions.slice(0, 7).map((suggestion, index) => ({
        id: `plot_${Date.now()}_${index}`,
        type: suggestion.type || 'HOOK',
        title: suggestion.title || 'Untitled Plot Point',
        description: suggestion.description || 'No description provided',
        reasoning: suggestion.reasoning || '',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5,
        subplot: suggestion.subplot || subplot,
        relatedChapters: Array.isArray(suggestion.relatedChapters) ? suggestion.relatedChapters : [],
        consistencyIssues: Array.isArray(suggestion.consistencyIssues) ? suggestion.consistencyIssues : []
      }));

      console.log(`🎭 Plot Agent: Generated ${plotSuggestions.length} suggestions for subplot "${subplot}"`);
      return plotSuggestions;
    } catch (error) {
      console.error('Plot Agent error:', error);
      return [];
    }
  }

  /**
   * Build a focused content summary from comprehensive vector search results
   */
  private buildRelevantContentSummary(
    chapters: Chapter[], 
    relevantNotes: any[], 
    relevantCharacters: any[],
    relevantChapters: any[],
    relevantLocations: any[],
    relatedPlotPoints: any[]
  ): string {
    const parts: string[] = [];

    // Add semantically relevant chapters (actual book content!)
    if (relevantChapters.length > 0) {
      const chaptersSummary = relevantChapters
        .map(ch => `Chapter "${ch.title}": ${ch.content?.substring(0, 300) || ch.description || 'No content'}...`)
        .join('\n');
      parts.push(`📖 Relevant Book Content:\n${chaptersSummary}`);
    }

    // Add related plot points for consistency 
    if (relatedPlotPoints.length > 0) {
      const plotSummary = relatedPlotPoints
        .map(plot => `${plot.type} [${plot.subplot || 'main'}]: "${plot.title}" - ${plot.description || 'No description'}`)
        .join('\n');
      parts.push(`🎯 Related Plot Points:\n${plotSummary}`);
    }

    // Add relevant characters from vector search
    if (relevantCharacters.length > 0) {
      const charactersSummary = relevantCharacters
        .map(char => `${char.name}: ${char.description?.substring(0, 150) || 'No description'}${char.description && char.description.length > 150 ? '...' : ''}`)
        .join('\n');
      parts.push(`👥 Relevant Characters:\n${charactersSummary}`);
    }

    // Add relevant locations from vector search
    if (relevantLocations.length > 0) {
      const locationsSummary = relevantLocations
        .map(loc => `${loc.name}: ${loc.description?.substring(0, 120) || 'No description'}`)
        .join('\n');
      parts.push(`🏰 Relevant Locations:\n${locationsSummary}`);
    }

    // Add relevant brainstorming notes from vector search
    if (relevantNotes.length > 0) {
      const notesSummary = relevantNotes
        .map(note => `"${note.title}": ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}`)
        .join('\n');
      parts.push(`💡 Relevant Ideas:\n${notesSummary}`);
    }

    // Fallback to basic chapter info if no vector search results
    if (parts.length === 0 && chapters.length > 0) {
      const chapterSummary = chapters
        .slice(0, 3)
        .map(ch => `Chapter ${ch.orderIndex + 1}: ${ch.title}`)
        .join(', ');
      parts.push(`Basic Chapters: ${chapterSummary}${chapters.length > 3 ? ` (and ${chapters.length - 3} more)` : ''}`);
    }

    return parts.length > 0 
      ? parts.join('\n\n') 
      : 'No relevant content found. Base suggestions on book title and description.';
  }

  /**
   * Generate complete plot structure suggestions with all 7 sections filled
   * Uses shared planning context and caching
   */
  async generatePlotStructures(
    chapters: Chapter[], 
    bookId: string, 
    additionalContext?: any
  ): Promise<{ suggestions: any[], context: string }> {
    const existingSuggestions = additionalContext?.existingSuggestions as Array<{ title: string; description: string }> | undefined;
    const cachedContext = additionalContext?.cachedContext as string | null | undefined;
    const skipVectorSearch = additionalContext?.skipVectorSearch as boolean | undefined;
    const customDirection = additionalContext?.customDirection as string | undefined;
    
    console.log('🎭 Plot Agent: Generating complete plot structures...');
    if (customDirection) {
      console.log('🎨 Using custom direction:', customDirection.substring(0, 100) + '...');
    }

    let planningContext: string;

    // Use cached planning data if available
    if (skipVectorSearch && cachedContext) {
      console.log('🎭 ⚡ Using CACHED planning context!');
      planningContext = cachedContext;
    } else {
      console.log('🎭 📚 Fetching fresh planning data from database...');
      planningContext = await PlanningContextService.buildPlanningContext(bookId);
    }

    // Get book details
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true, description: true, genre: true }
    });

    // Get existing plot points to avoid duplicates
    const existingPlotPoints = await prisma.plotPoint.findMany({
      where: { bookId },
      select: { title: true, description: true, type: true },
      orderBy: { orderIndex: 'asc' }
    });

    const existingPlotsList = existingPlotPoints.length > 0
      ? existingPlotPoints.map((p, i) => `${i + 1}. [${p.type}] "${p.title}": ${p.description?.substring(0, 100) || 'No description'}`).join('\n')
      : 'No existing plot points yet.';

    const existingSuggestionsList = existingSuggestions && existingSuggestions.length > 0
      ? existingSuggestions.map((s, i) => `${i + 1}. "${s.title}": ${s.description.substring(0, 100)}`).join('\n')
      : 'None';

    const customDirectionSection = customDirection 
      ? `\n      CUSTOM DIRECTION FROM USER:
      ${customDirection}
      
      ⚠️ IMPORTANT: Incorporate this custom direction into your plot suggestions. Shape the plot structures to align with these specific requirements and themes.\n`
      : '';

    const prompt = `
      Generate NEW complete plot structure suggestions for this book, with ALL 7 sections fully filled out.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description'}"
      Genre: ${book?.genre || 'Not specified'}
${customDirectionSection}
      COMPREHENSIVE PLANNING DATA:
      ${planningContext}

      EXISTING PLOT POINTS (DO NOT DUPLICATE):
      ${existingPlotsList}

      EXISTING SUGGESTIONS (DO NOT DUPLICATE):
      ${existingSuggestionsList}

      CRITICAL REQUIREMENTS:
      1. Create completely NEW plot structures - avoid all duplicates
      2. Generate EXACTLY ONE plot point for EACH of the 7 sections (keep descriptions concise - max 100 chars)
      3. Ensure ALL 7 sections have exactly 1 plot point each
      4. Base everything on the planning data above${customDirection ? ' AND the custom direction provided' : ''}
      5. Keep titles short (max 5 words) and descriptions brief

      Return a JSON array with this EXACT structure:
      [
        {
          "title": "Plot Structure Title (short)",
          "description": "Brief overview (1 sentence max)",
          "plotPoints": {
            "hook": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ],
            "plotTurn1": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ],
            "pinch1": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ],
            "midpoint": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ],
            "pinch2": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ],
            "plotTurn2": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ],
            "resolution": [
              { "title": "Short Title", "description": "Brief description under 100 chars", "orderIndex": 0 }
            ]
          },
          "reasoning": "Brief reason (2 sentences)",
          "confidence": 0.85
        }
      ]

      Generate 3 distinct, complete plot structures. Keep ALL content CONCISE. Ensure valid, complete JSON.
    `;

    try {
      const response = await this.callOpenAI(prompt);
      const plotStructures = this.cleanAndParseJSON(response);

      const suggestions = plotStructures.slice(0, 3).map((structure: any, index: number) => ({
        id: `plot_structure_${Date.now()}_${index}`,
        title: structure.title || 'Untitled Plot Structure',
        description: structure.description || '',
        plotPoints: structure.plotPoints || {
          hook: [],
          plotTurn1: [],
          pinch1: [],
          midpoint: [],
          pinch2: [],
          plotTurn2: [],
          resolution: []
        },
        reasoning: structure.reasoning || '',
        confidence: typeof structure.confidence === 'number' ? structure.confidence : 0.7
      }));

      console.log(`🎭 Plot Agent: Generated ${suggestions.length} complete plot structures`);
      return {
        suggestions,
        context: planningContext
      };
    } catch (error) {
      console.error('Plot Agent error:', error);
      return {
        suggestions: [],
        context: planningContext || ''
      };
    }
  }
}
