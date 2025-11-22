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
      // Use Promise.allSettled to handle individual failures gracefully
      const results = await Promise.allSettled([
        this.timelineAgent.analyze(chapters, bookId).catch(err => {
          console.error('❌ Timeline agent error:', err);
          return [];
        }),
        this.characterAgent.analyze(chapters, bookId).catch(err => {
          console.error('❌ Character agent error:', err);
          return [];
        }),
        this.locationAgent.analyze(chapters, bookId).catch(err => {
          console.error('❌ Location agent error:', err);
          return [];
        }),
        this.plotAgent.analyze(chapters, bookId, 'main').catch(err => {
          console.error('❌ Plot agent error:', err);
          return [];
        }),
        this.sceneAgent.analyze(chapters, bookId).catch(err => {
          console.error('❌ Scene agent error:', err);
          return [];
        }),
        this.brainstormingAgent.analyze(chapters, bookId).catch(err => {
          console.error('❌ Brainstorming agent error:', err);
          return [];
        })
      ]);

      // Extract results, handling both fulfilled and rejected promises
      const timelineEventsResult = results[0].status === 'fulfilled' ? results[0].value : [];
      const charactersResult = results[1].status === 'fulfilled' ? results[1].value : [];
      const locationsResult = results[2].status === 'fulfilled' ? results[2].value : [];
      const plotPointsResult = results[3].status === 'fulfilled' ? results[3].value : [];
      const sceneCardsResult = results[4].status === 'fulfilled' ? results[4].value : [];
      const brainstormingNotesResult = results[5].status === 'fulfilled' ? results[5].value : [];

      // Extract suggestions from agents that return { suggestions, context } objects
      // Some agents return arrays directly, others return objects with suggestions property
      const timelineEvents = Array.isArray(timelineEventsResult) ? timelineEventsResult : (timelineEventsResult as any)?.suggestions || [];
      const characters = Array.isArray(charactersResult) ? charactersResult : (charactersResult as any)?.suggestions || [];
      const locations = Array.isArray(locationsResult) ? locationsResult : (locationsResult as any)?.suggestions || [];
      const plotPoints = Array.isArray(plotPointsResult) ? plotPointsResult : (plotPointsResult as any)?.suggestions || [];
      const sceneCards = Array.isArray(sceneCardsResult) ? sceneCardsResult : (sceneCardsResult as any)?.suggestions || [];
      const brainstormingNotes = Array.isArray(brainstormingNotesResult) ? brainstormingNotesResult : (brainstormingNotesResult as any)?.suggestions || [];

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
  ): Promise<any[] | any> {
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
          // BrainstormingAgent returns { suggestions, context } instead of array
          return await this.brainstormingAgent.analyze(chapters, bookId, additionalContext);
          
        case 'characters':
          // CharacterAgent returns { suggestions, context } instead of array
          return await this.characterAgent.analyze(chapters, bookId, additionalContext);
          
        case 'locations':
          // LocationAgent returns { suggestions, context } instead of array
          return await this.locationAgent.analyze(chapters, bookId, additionalContext);
          
        case 'scenes':
          // SceneAgent returns { suggestions, context } instead of array
          return await this.sceneAgent.analyze(chapters, bookId, additionalContext);
          
        case 'plot':
          // Check if we should generate plot structures or individual plot points
          if (additionalContext?.generateStructures) {
            return await this.plotAgent.generatePlotStructures(chapters, bookId, additionalContext);
          } else {
            const subplot = additionalContext?.subplot || 'main';
            return await this.plotAgent.analyze(chapters, bookId, subplot);
          }
          
        case 'timeline':
          // TimelineAgent returns { suggestions, context } instead of array
          return await this.timelineAgent.analyze(chapters, bookId, additionalContext);
          
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
  async generateBookDraft(bookId: string, writingStylePrompt?: string): Promise<BookDraft> {
    console.log(`🤖 AI Orchestrator: Generating book draft for ${bookId}...`);
    console.log(`🤖 AI Orchestrator: DraftAgent instance:`, !!this.draftAgent);
    if (writingStylePrompt) {
      console.log(`🤖 AI Orchestrator: Using custom writing style prompt`);
    }
    
    if (!this.draftAgent) {
      throw new Error('DraftAgent not initialized');
    }
    
    try {
      return await this.draftAgent.generateDraft(bookId, writingStylePrompt);
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
