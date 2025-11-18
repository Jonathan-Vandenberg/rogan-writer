import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';

export interface ChapterOutline {
  title: string;
  description: string;
  plotPointTypes: string[];
  sceneCards: string[];
  keyCharacters: string[];
  keyLocations: string[];
  wordTargetRange: { min: number; max: number };
}

export interface GeneratedChapter {
  id: string;
  title: string;
  description: string;
  content: string;
  orderIndex: number;
  wordCount: number;
  plotPoints: string[];
  scenes: string[];
}

export interface BookDraft {
  chapters: GeneratedChapter[];
  totalWordCount: number;
  structure: string;
  summary: string;
}

export class DraftAgent extends AIAgent {
  // Required implementation for AIAgent interface
  async analyze(chapters: Chapter[], bookId: string): Promise<any[]> {
    // DraftAgent doesn't provide suggestions like other agents
    // It generates complete drafts instead
    return [];
  }

  /**
   * Generate a complete book draft from planning content
   */
  async generateDraft(bookId: string): Promise<BookDraft> {
    console.log('📝 Draft Agent: Starting book draft generation...');
    
    // Gather all planning content
    const planningData = await this.gatherPlanningContent(bookId);
    
    if (!this.hasSufficientPlanning(planningData)) {
      throw new Error('Insufficient planning content. Need at least characters, plot points, or scenes to generate a draft.');
    }

    // Create chapter outline from plot structure
    const chapterOutlines = await this.createChapterOutlines(planningData);
    
    // Generate content for each chapter
    const generatedChapters: GeneratedChapter[] = [];
    
    for (const [index, outline] of chapterOutlines.entries()) {
      console.log(`📝 Draft Agent: Generating chapter ${index + 1}: ${outline.title}`);
      
      const chapter = await this.generateChapterContent(
        outline, 
        index, 
        planningData,
        generatedChapters // Previous chapters for context
      );
      
      generatedChapters.push(chapter);
    }

    const totalWordCount = generatedChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

    console.log(`📝 Draft Agent: Generated ${generatedChapters.length} chapters, ${totalWordCount} words total`);

    return {
      chapters: generatedChapters,
      totalWordCount,
      structure: this.analyzeStructure(generatedChapters),
      summary: await this.generateBookSummary(generatedChapters, planningData)
    };
  }

  /**
   * Create chapters and pages in the database from generated draft
   */
  async saveDraftToDatabase(bookId: string, draft: BookDraft): Promise<void> {
    console.log('💾 Draft Agent: Saving draft to database...');

    try {
      // Clear existing chapters for this book (user confirmation should happen before this)
      await prisma.chapter.deleteMany({
        where: { bookId }
      });

      // Sort chapters by orderIndex to ensure proper sequencing
      const sortedChapters = [...draft.chapters].sort((a, b) => a.orderIndex - b.orderIndex);

      for (const [index, chapterData] of sortedChapters.entries()) {
        // Create the chapter with sequential orderIndex
        const chapter = await prisma.chapter.create({
          data: {
            title: chapterData.title,
            description: chapterData.description,
            content: chapterData.content,
            orderIndex: index, // Use sequential index for proper ordering
            wordCount: chapterData.wordCount,
            bookId: bookId
          }
        });

        // Create pages for the chapter (split content by estimated page breaks)
        await this.createPagesForChapter(chapter.id, chapterData.content);
      }

      console.log(`💾 Draft Agent: Successfully saved ${draft.chapters.length} chapters to database`);
    } catch (error) {
      console.error('💾 Draft Agent: Error saving to database:', error);
      throw error;
    }
  }

  private async gatherPlanningContent(bookId: string) {
    const [
      plotPoints,
      characters,
      locations,
      timeline,
      sceneCards,
      brainstorming,
      book
    ] = await Promise.all([
      prisma.plotPoint.findMany({
        where: { bookId },
        orderBy: [{ subplot: 'asc' }, { orderIndex: 'asc' }]
      }),
      prisma.character.findMany({
        where: { bookId },
        orderBy: { role: 'asc' }
      }),
      prisma.location.findMany({
        where: { bookId },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.timelineEvent.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.sceneCard.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.brainstormingNote.findMany({
        where: { bookId },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.book.findUnique({
        where: { id: bookId }
      })
    ]);

    return {
      plotPoints,
      characters,
      locations,
      timeline,
      sceneCards,
      brainstorming,
      book
    };
  }

  private hasSufficientPlanning(planningData: any): boolean {
    const { plotPoints, characters, locations, sceneCards, brainstorming, timeline } = planningData;
    
    // Need at least some planning content to work with
    return (
      plotPoints.length > 0 || 
      sceneCards.length > 0 || 
      characters.length > 0 ||
      locations.length > 0 ||
      brainstorming.length > 0 ||
      timeline.length > 0
    );
  }

  private async createChapterOutlines(planningData: any): Promise<ChapterOutline[]> {
    const { book, plotPoints, characters, locations, brainstorming, timeline, sceneCards } = planningData;
    
    console.log('📝 Draft Agent: Using ALL planning content for comprehensive chapter outline creation...');
    
    // Use ALL the planning data we already fetched - no limits, no missing content!
    const allPlotPoints = plotPoints || [];
    const allCharacters = characters || [];
    const allLocations = locations || [];
    const allBrainstorming = brainstorming || [];
    const allTimeline = timeline || [];
    const allScenes = sceneCards || [];
    
    console.log(`📊 Outline context: ${allPlotPoints.length} plots, ${allCharacters.length} characters, ${allLocations.length} locations, ${allBrainstorming.length} ideas, ${allTimeline.length} timeline, ${allScenes.length} scenes`);
    
    // Build comprehensive outline context from vector search results
    const outlineVectorContext = this.buildOutlineVectorContext(
      allPlotPoints,
      allCharacters,
      allLocations,
      allBrainstorming,
      allTimeline,
      allScenes
    );
    
    const prompt = `
      Create a chapter outline for a book based on ALL comprehensive planning content:

      BOOK INFO:
      Title: ${book?.title || 'Untitled'}
      Description: ${book?.description || 'No description provided'}
      Genre: ${book?.genre || 'Unknown'}
      Target Words: ${book?.targetWords || 'Not specified'}

      ALL PLANNING CONTENT (Complete Planning Context):
      ${outlineVectorContext}

      Create a logical chapter structure that:
      1. **ALIGNS WITH THE BOOK'S CORE STORY**: Use the book title and description as the foundation for all chapter decisions
      2. **USES ALL PLANNING CONTENT**: The content above includes ALL your planning data - use every relevant element to create the most comprehensive chapter structure
      3. Follows the plot points in chronological order 
      4. Incorporates ALL scene cards and timeline events that fit the narrative flow
      5. Integrates ALL brainstorming themes organically where they enhance the story
      6. Has natural chapter breaks at plot turning points
      7. Aims for 2,000-4,000 words per chapter based on content density
      8. Includes ALL characters and locations that serve the story

      Return a JSON array with this structure:
      [
        {
          "title": "Chapter Title",
          "description": "What happens in this chapter",
          "plotPointTypes": ["HOOK", "PLOT_TURN_1"],
          "sceneCards": ["Scene Title 1", "Scene Title 2"],
          "keyCharacters": ["Character 1", "Character 2"],
          "keyLocations": ["Location 1"],
          "wordTargetRange": {"min": 2000, "max": 3500}
        }
      ]

      Aim for 8-15 chapters depending on the content available.
      Ensure each chapter has a clear purpose and narrative arc.
    `;

    try {
      const response = await this.callOpenAI(prompt, book?.id);
      const outlines = this.cleanAndParseJSON(response);
      
      // Ensure outlines is an array
      if (!Array.isArray(outlines)) {
        console.warn('Draft Agent: AI returned non-array response, using fallback');
        return this.createFallbackOutlines(allPlotPoints, allScenes);
      }
      
      if (outlines.length === 0) {
        console.warn('Draft Agent: AI returned empty array, using fallback');
        return this.createFallbackOutlines(allPlotPoints, allScenes);
      }
      
      return outlines.map((outline: any, index: number) => ({
        title: outline.title || `Chapter ${index + 1}`,
        description: outline.description || 'No description provided',
        plotPointTypes: outline.plotPointTypes || [],
        sceneCards: outline.sceneCards || [],
        keyCharacters: outline.keyCharacters || [],
        keyLocations: outline.keyLocations || [],
        wordTargetRange: outline.wordTargetRange || { min: 2000, max: 3500 }
      }));
    } catch (error) {
      console.error('Draft Agent: Error creating chapter outlines:', error);
      // Fallback to simple structure
      return this.createFallbackOutlines(allPlotPoints, allScenes);
    }
  }

  private createFallbackOutlines(allPlotPoints: any[], allScenes: any[]): ChapterOutline[] {
    // Simple fallback based on plot points
    const chapters: ChapterOutline[] = [];
    const plotPointsPerChapter = Math.max(1, Math.floor(allPlotPoints.length / 8));
    
    for (let i = 0; i < allPlotPoints.length; i += plotPointsPerChapter) {
      const chapterPlotPoints = allPlotPoints.slice(i, i + plotPointsPerChapter);
      const chapterIndex = chapters.length + 1;
      
      chapters.push({
        title: `Chapter ${chapterIndex}`,
        description: `Chapter focusing on: ${chapterPlotPoints.map((pp: any) => pp.title).join(', ')}`,
        plotPointTypes: chapterPlotPoints.map((pp: any) => pp.type),
        sceneCards: [],
        keyCharacters: [],
        keyLocations: [],
        wordTargetRange: { min: 2000, max: 3500 }
      });
    }

    return chapters.length > 0 ? chapters : [{
      title: 'Chapter 1',
      description: 'Opening chapter',
      plotPointTypes: [],
      sceneCards: [],
      keyCharacters: [],
      keyLocations: [],
      wordTargetRange: { min: 2000, max: 3500 }
    }];
  }

  private async generateChapterContent(
    outline: ChapterOutline,
    chapterIndex: number,
    planningData: any,
    previousChapters: GeneratedChapter[]
  ): Promise<GeneratedChapter> {
    const { book, plotPoints, characters, locations, brainstorming, timeline, sceneCards } = planningData;
    
    console.log(`📝 Draft Agent: Using ALL planning content for Chapter ${chapterIndex + 1}: "${outline.title}"`);
    
    // Use ALL the planning data we already have - comprehensive context for each chapter
    const relevantPlotPoints = plotPoints || [];
    const relevantCharacters = characters || [];
    const relevantLocations = locations || [];
    const relevantBrainstorming = brainstorming || [];
    const relevantTimeline = timeline || [];
    const relevantScenes = sceneCards || [];
    
    // Get existing chapters for continuity context
    const relevantChapters = await prisma.chapter.findMany({
      where: { bookId: book.id },
      select: { title: true, content: true, description: true },
      orderBy: { orderIndex: 'asc' },
      take: 20 // Limit existing chapters to avoid token overflow
    });
    
    console.log(`📊 Chapter ${chapterIndex + 1} context: ${relevantPlotPoints.length} plots, ${relevantCharacters.length} characters, ${relevantLocations.length} locations, ${relevantBrainstorming.length} ideas, ${relevantTimeline.length} timeline events, ${relevantScenes.length} scenes`);
    
    // Build comprehensive content summary from ALL planning data
    const allPlanningContent = this.buildChapterVectorContext(
      outline,
      relevantPlotPoints,
      relevantCharacters, 
      relevantLocations,
      relevantBrainstorming,
      relevantTimeline,
      relevantScenes,
      relevantChapters
    );

    // Previous chapter context for continuity
    const previousContext = previousChapters.length > 0 
      ? previousChapters[previousChapters.length - 1]
      : null;

    const prompt = `
      Write a complete chapter of a ${book?.genre || 'fiction'} novel based on this outline and ALL comprehensive planning content.

      BOOK CONTEXT:
      Title: ${book?.title || 'Untitled'}
      Description: ${book?.description || 'No description provided'}
      Genre: ${book?.genre || 'Fiction'}

      CHAPTER OUTLINE:
      Title: ${outline.title}
      Description: ${outline.description}
      Target Length: ${outline.wordTargetRange.min}-${outline.wordTargetRange.max} words

      ALL PLANNING CONTENT (Complete Planning Context):
      ${allPlanningContent}

      ${previousContext ? `PREVIOUS CHAPTER CONTEXT:\nTitle: ${previousContext.title}\nLast 200 characters: ${previousContext.content.slice(-200)}` : 'This is the opening chapter.'}

      WRITING GUIDELINES:
      1. **STAY TRUE TO THE BOOK'S CORE CONCEPT**: Ensure the chapter aligns with the book's title, description, and overall premise
      2. **USE ALL PLANNING CONTENT**: The content above includes ALL your planning data - incorporate every relevant element to create the richest possible chapter
      3. Write in third person limited or omniscient perspective
      4. Show don't tell - use action, dialogue, and sensory details
      5. Include character development and dialogue
      6. Describe settings vividly using the location information
      7. Follow the plot points while making the story flow naturally
      8. Maintain consistency with previous chapters and existing content
      9. End with a hook or transition to the next chapter
      10. Write ${outline.wordTargetRange.min}-${outline.wordTargetRange.max} words

      Write the complete chapter content below:
    `;

    try {
      const chapterContent = await this.callOpenAIForText(prompt, book.id);
      
      // Count words (rough estimate)
      const wordCount = chapterContent.split(/\s+/).length;

      return {
        id: `chapter_${Date.now()}_${chapterIndex}`,
        title: outline.title,
        description: outline.description,
        content: chapterContent,
        orderIndex: chapterIndex,
        wordCount: wordCount,
        plotPoints: outline.plotPointTypes,
        scenes: outline.sceneCards
      };
    } catch (error) {
      console.error(`Draft Agent: Error generating chapter ${chapterIndex + 1}:`, error);
      
      // Fallback content
      return {
        id: `chapter_${Date.now()}_${chapterIndex}`,
        title: outline.title,
        description: outline.description,
        content: `[Chapter content could not be generated due to an error. This is a placeholder for ${outline.title}.]`,
        orderIndex: chapterIndex,
        wordCount: 50,
        plotPoints: outline.plotPointTypes,
        scenes: outline.sceneCards
      };
    }
  }

  private async createPagesForChapter(chapterId: string, content: string): Promise<void> {
    // Estimate pages based on word count (roughly 250-300 words per page)
    const wordsPerPage = 275;
    const words = content.split(/\s+/);
    const totalWords = words.length;
    const estimatedPages = Math.max(1, Math.ceil(totalWords / wordsPerPage));
    
    const pages = [];
    
    for (let pageNum = 1; pageNum <= estimatedPages; pageNum++) {
      const startWordIndex = (pageNum - 1) * wordsPerPage;
      const endWordIndex = Math.min(pageNum * wordsPerPage, totalWords);
      
      // Calculate character positions
      const startPosition = words.slice(0, startWordIndex).join(' ').length;
      const endPosition = words.slice(0, endWordIndex).join(' ').length;
      const pageWordCount = endWordIndex - startWordIndex;
      
      pages.push({
        pageNumber: pageNum,
        startPosition: startPosition,
        endPosition: endPosition,
        wordCount: pageWordCount,
        chapterId: chapterId
      });
    }

    // Create all pages in database
    await prisma.page.createMany({
      data: pages
    });
  }

  private analyzeStructure(chapters: GeneratedChapter[]): string {
    return `Generated ${chapters.length} chapters with a total of ${chapters.reduce((sum, ch) => sum + ch.wordCount, 0)} words. Average chapter length: ${Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length)} words.`;
  }

  private async generateBookSummary(chapters: GeneratedChapter[], planningData: any): Promise<string> {
    const { book } = planningData;
    const chapterSummaries = chapters.map(ch => `${ch.title}: ${ch.description}`).join('\n');
    
    const prompt = `
      Create a brief book summary based on the book concept and generated chapter outlines:
      
      BOOK CONCEPT:
      Title: ${book?.title || 'Untitled'}
      Description: ${book?.description || 'No description provided'}
      Genre: ${book?.genre || 'Fiction'}
      
      CHAPTER OUTLINES:
      ${chapterSummaries}
      
      Write a 2-3 sentence summary that captures the main story arc and themes, staying true to the book's original concept.
    `;

    try {
      const summary = await this.callOpenAIForText(prompt, book?.id);
      return summary.trim();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return `A ${chapters.length}-chapter story generated from planning content.`;
    }
  }

  /**
   * Build comprehensive outline context from vector search results
   */
  private buildOutlineVectorContext(
    plotPoints: any[],
    characters: any[],
    locations: any[],
    brainstorming: any[],
    timeline: any[],
    scenes: any[]
  ): string {
    const sections: string[] = [];

    // ALL plot points for complete outline structure
    if (plotPoints.length > 0) {
      const plotSection = plotPoints
        .map(plot => `${plot.type} [${plot.subplot || 'main'}]: "${plot.title}" - ${plot.description || 'No description'}`)
        .join('\n');
      sections.push(`🎯 PLOT STRUCTURE (${plotPoints.length} total):\n${plotSection}`);
    }

    // ALL characters for comprehensive planning
    if (characters.length > 0) {
      const charSection = characters
        .map(char => `${char.name}: ${char.description || 'No description'}`)
        .join('\n');
      sections.push(`👥 ALL CHARACTERS (${characters.length} total):\n${charSection}`);
    }

    // ALL locations for complete world-building
    if (locations.length > 0) {
      const locSection = locations
        .map(loc => `${loc.name}: ${loc.description || 'No description'}`)
        .join('\n');
      sections.push(`🏰 ALL LOCATIONS (${locations.length} total):\n${locSection}`);
    }

    // ALL scene structure guidance
    if (scenes.length > 0) {
      const sceneSection = scenes
        .map(scene => `"${scene.title}": ${scene.description || 'No description'}`)
        .join('\n');
      sections.push(`🎬 ALL SCENE STRUCTURE (${scenes.length} total):\n${sceneSection}`);
    }

    // ALL thematic and creative guidance
    if (brainstorming.length > 0) {
      const brainSection = brainstorming
        .map(note => `"${note.title}": ${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}`)
        .join('\n');
      sections.push(`💡 ALL BRAINSTORMING IDEAS (${brainstorming.length} total):\n${brainSection}`);
    }

    // ALL timeline structure for chronological flow
    if (timeline.length > 0) {
      const timeSection = timeline
        .map(event => `"${event.title}": ${event.description || 'No description'} ${event.eventDate ? `[${event.eventDate}]` : ''}`)
        .join('\n');
      sections.push(`⏰ ALL TIMELINE EVENTS (${timeline.length} total):\n${timeSection}`);
    }

    return sections.length > 0 
      ? sections.join('\n\n') 
      : 'No planning content available for outline creation.';
  }

  /**
   * Build comprehensive chapter context from all planning data
   */
  private buildChapterVectorContext(
    outline: ChapterOutline,
    plotPoints: any[],
    characters: any[],
    locations: any[],
    brainstorming: any[],
    timeline: any[],
    scenes: any[],
    existingChapters: any[]
  ): string {
    const sections: string[] = [];

    // ALL plot points for comprehensive context
    if (plotPoints.length > 0) {
      const plotSection = plotPoints
        .map(plot => `${plot.type} [${plot.subplot || 'main'}]: "${plot.title}" - ${plot.description || 'No description'}`)
        .join('\n');
      sections.push(`🎯 ALL PLOT POINTS (${plotPoints.length} total):\n${plotSection}`);
    }

    // ALL characters for complete context
    if (characters.length > 0) {
      const charSection = characters
        .map(char => `${char.name}: ${char.description || 'No description'}`)
        .join('\n');
      sections.push(`👥 ALL CHARACTERS (${characters.length} total):\n${charSection}`);
    }

    // ALL locations for complete world-building
    if (locations.length > 0) {
      const locSection = locations
        .map(loc => `${loc.name}: ${loc.description || 'No description'}`)
        .join('\n');
      sections.push(`🏰 ALL LOCATIONS (${locations.length} total):\n${locSection}`);
    }

    // ALL brainstorming ideas for complete creative context
    if (brainstorming.length > 0) {
      const brainSection = brainstorming
        .map(note => `"${note.title}": ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}`)
        .join('\n');
      sections.push(`💡 ALL BRAINSTORMING IDEAS (${brainstorming.length} total):\n${brainSection}`);
    }

    // ALL timeline events for complete chronology
    if (timeline.length > 0) {
      const timeSection = timeline
        .map(event => `"${event.title}": ${event.description || 'No description'} ${event.eventDate ? `[${event.eventDate}]` : ''}`)
        .join('\n');
      sections.push(`⏰ ALL TIMELINE EVENTS (${timeline.length} total):\n${timeSection}`);
    }

    // ALL scene cards for complete structure
    if (scenes.length > 0) {
      const sceneSection = scenes
        .map(scene => `"${scene.title}": ${scene.description || 'No description'}\nPurpose: ${scene.purpose || 'Unknown'}\nConflict: ${scene.conflict || 'Unknown'}`)
        .join('\n\n');
      sections.push(`🎬 ALL SCENE CARDS (${scenes.length} total):\n${sceneSection}`);
    }

    // Existing chapters for continuity context (limited to avoid token overflow)
    if (existingChapters.length > 0) {
      const chapterSection = existingChapters
        .slice(0, 10) // Limit existing chapters to avoid token overflow
        .map(ch => `"${ch.title}": ${ch.content?.substring(0, 300) || ch.description || 'No content'}...`)
        .join('\n');
      sections.push(`📖 EXISTING CHAPTERS (${existingChapters.length} total, showing ${Math.min(10, existingChapters.length)}):\n${chapterSection}`);
    }

    return sections.length > 0 
      ? sections.join('\n\n') 
      : 'No planning content available for this chapter.';
  }

  // Method for generating text content (not JSON)
  private async callOpenAIForText(prompt: string, bookId?: string): Promise<string> {
    try {
      // Get userId from bookId for OpenRouter config and temperature
      let userId: string | undefined;
      if (bookId) {
        const book = await prisma.book.findUnique({
          where: { id: bookId },
          select: { userId: true },
        });
        userId = book?.userId;
      }

      const { llmService } = await import('../llm.service');
      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          system_prompt: 'You are an expert creative writer. Write engaging, well-structured prose. Return only the requested text content without any JSON formatting, code blocks, or additional commentary.',
          // Don't set temperature - use user's suggestions temperature (higher creativity for prose)
          max_tokens: 8000, // Increased from 2000 - creative writing needs longer responses (GPT-4 Turbo: 128K context)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'suggestions', // Use suggestions temperature for creative writing
        }
      );

      return response.content?.trim() || '';
    } catch (error) {
      console.error('LLM API error for text generation:', error);
      throw new Error('Failed to generate chapter content');
    }
  }
}
