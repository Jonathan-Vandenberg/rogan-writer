import { Chapter } from '@prisma/client';
import { prisma } from '@/lib/db';

// Import all specialized agents
import { CharacterAgent, CharacterSuggestion } from './ai-agents/character-agent';
import { PlotAgent, PlotSuggestion } from './ai-agents/plot-agent';
import { LocationAgent, LocationSuggestion } from './ai-agents/location-agent';
import { TimelineAgent, TimelineEventSuggestion } from './ai-agents/timeline-agent';
import { SceneAgent, SceneCardSuggestion } from './ai-agents/scene-agent';
import { BrainstormingAgent, BrainstormingSuggestion } from './ai-agents/brainstorming-agent';
import { DraftAgent, BookDraft } from './ai-agents/draft-agent';

export interface ComprehensiveAnalysisResult {
  timeline: TimelineEventSuggestion[];
  characters: CharacterSuggestion[];
  locations: LocationSuggestion[];
  plotPoints: PlotSuggestion[];
  sceneCards: SceneCardSuggestion[];
  brainstorming: BrainstormingSuggestion[];
}

export class AIOrchestrator {
  private characterAgent: CharacterAgent;
  private plotAgent: PlotAgent;
  private locationAgent: LocationAgent;
  private timelineAgent: TimelineAgent;
  private sceneAgent: SceneAgent;
  private brainstormingAgent: BrainstormingAgent;
  private draftAgent: DraftAgent;

  constructor() {
    console.log('🤖 AI Orchestrator: Initializing specialized agents...');
    
    // Initialize all specialized agents
    this.characterAgent = new CharacterAgent();
    this.plotAgent = new PlotAgent();
    this.locationAgent = new LocationAgent();
    this.timelineAgent = new TimelineAgent();
    this.sceneAgent = new SceneAgent();
    this.brainstormingAgent = new BrainstormingAgent();
    this.draftAgent = new DraftAgent();
    
    console.log('🤖 AI Orchestrator: All agents initialized successfully');
    console.log('🤖 AI Orchestrator: Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this)));
  }

  /**
   * Run comprehensive analysis across all modules using specialized agents
   */
  async comprehensiveAnalysis(bookId: string): Promise<ComprehensiveAnalysisResult> {
    try {
      console.log('🤖 AI Orchestrator: Starting comprehensive analysis for book:', bookId);
      
      // Get book chapters
      const chapters = await prisma.chapter.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' }
      });

      if (chapters.length === 0) {
        console.log('🤖 AI Orchestrator: No chapters found for analysis');
        return this.getEmptyResult();
      }

      console.log(`🤖 AI Orchestrator: Found ${chapters.length} chapters, dispatching to agents...`);

      // Run all agents in parallel for maximum efficiency
      const [
        timelineEvents,
        characters,
        locations,
        plotPoints,
        sceneCards,
        brainstormingNotes
      ] = await Promise.all([
        this.timelineAgent.analyze(chapters, bookId),
        this.characterAgent.analyze(chapters, bookId),
        this.locationAgent.analyze(chapters, bookId),
        this.plotAgent.analyze(chapters, bookId, 'main'), // Default to main subplot
        this.sceneAgent.analyze(chapters, bookId),
        this.brainstormingAgent.analyze(chapters, bookId)
      ]);

      console.log('🤖 AI Orchestrator: All agents completed successfully');
      console.log(`📊 Results: ${timelineEvents.length} timeline, ${characters.length} characters, ${locations.length} locations, ${plotPoints.length} plots, ${sceneCards.length} scenes, ${brainstormingNotes.length} ideas`);

      return {
        timeline: timelineEvents,
        characters: characters,
        locations: locations,
        plotPoints: plotPoints,
        sceneCards: sceneCards,
        brainstorming: brainstormingNotes
      };

    } catch (error) {
      console.error('🤖 AI Orchestrator: Error in comprehensive analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze specific module using the appropriate specialized agent
   */
  async analyzeModule(
    type: 'brainstorming' | 'characters' | 'locations' | 'plot' | 'timeline' | 'scenes',
    bookId: string,
    additionalContext?: any
  ): Promise<any[]> {
    try {
      console.log(`🤖 AI Orchestrator: Analyzing ${type} for book:`, bookId);
      
      // Get book chapters
      const chapters = await prisma.chapter.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' }
      });

      if (chapters.length === 0) {
        console.log(`🤖 AI Orchestrator: No chapters found for ${type} analysis`);
        return [];
      }

      // Dispatch to appropriate agent
      switch (type) {
        case 'brainstorming':
          return await this.brainstormingAgent.analyze(chapters, bookId);
          
        case 'characters':
          return await this.characterAgent.analyze(chapters, bookId);
          
        case 'locations':
          return await this.locationAgent.analyze(chapters, bookId);
          
        case 'plot':
          const subplot = additionalContext?.subplot || 'main';
          return await this.plotAgent.analyze(chapters, bookId, subplot);
          
        case 'timeline':
          return await this.timelineAgent.analyze(chapters, bookId);
          
        case 'scenes':
          return await this.sceneAgent.analyze(chapters, bookId);
          
        default:
          console.error(`🤖 AI Orchestrator: Unknown module type: ${type}`);
          return [];
      }
    } catch (error) {
      console.error(`🤖 AI Orchestrator: Error analyzing ${type}:`, error);
      throw error;
    }
  }

  /**
   * Quick analysis for backward compatibility with existing API
   */
  async quickAnalysis(
    type: 'brainstorming' | 'characters' | 'plot',
    chapters: Chapter[],
    bookId: string,
    additionalContext?: any
  ): Promise<any[]> {
    console.log(`🤖 AI Orchestrator: Quick analysis of ${type}...`);
    
    // Dispatch to appropriate agent
    switch (type) {
      case 'brainstorming':
        return await this.brainstormingAgent.analyze(chapters, bookId);
        
      case 'characters':
        return await this.characterAgent.analyze(chapters, bookId);
        
      case 'plot':
        const subplot = additionalContext?.subplot || 'main';
        return await this.plotAgent.analyze(chapters, bookId, subplot);
        
      default:
        console.error(`🤖 AI Orchestrator: Unsupported quick analysis type: ${type}`);
        return [];
    }
  }

  /**
   * Generate a complete book draft from planning content
   */
  async generateBookDraft(bookId: string): Promise<BookDraft> {
    console.log(`🤖 AI Orchestrator: Generating book draft for ${bookId}...`);
    console.log(`🤖 AI Orchestrator: DraftAgent instance:`, !!this.draftAgent);
    
    if (!this.draftAgent) {
      throw new Error('DraftAgent not initialized');
    }
    
    try {
      return await this.draftAgent.generateDraft(bookId);
    } catch (error) {
      console.error(`🤖 AI Orchestrator: Error generating book draft:`, error);
      throw error;
    }
  }

  /**
   * Save generated draft to database (creates chapters and pages)
   */
  async saveDraftToDatabase(bookId: string, draft: BookDraft): Promise<void> {
    console.log(`🤖 AI Orchestrator: Saving draft to database for ${bookId}...`);
    
    try {
      await this.draftAgent.saveDraftToDatabase(bookId, draft);
    } catch (error) {
      console.error(`🤖 AI Orchestrator: Error saving draft to database:`, error);
      throw error;
    }
  }

  private getEmptyResult(): ComprehensiveAnalysisResult {
    return {
      timeline: [],
      characters: [],
      locations: [],
      plotPoints: [],
      sceneCards: [],
      brainstorming: []
    };
  }
}
