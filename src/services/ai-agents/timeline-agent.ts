import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';

export interface TimelineEventSuggestion {
  id: string;
  title: string;
  description: string;
  eventType: 'historical' | 'personal' | 'plot_event';
  eventDate?: string;
  reasoning: string;
  confidence: number;
}

export class TimelineAgent extends AIAgent {
  async analyze(chapters: Chapter[], bookId: string): Promise<TimelineEventSuggestion[]> {
    console.log('📅 Timeline Agent: Starting analysis...');
    
    const combinedContent = this.combinedChapterContent(chapters);
    
    // Get existing timeline events to avoid duplicates
    const existingEvents = await prisma.timelineEvent.findMany({
      where: { bookId },
      select: { title: true, description: true, eventDate: true }
    });

    // Simple list of existing events for AI to avoid
    const existingEventsList = existingEvents.length > 0 
      ? existingEvents.map(event => `(${event.title}, ${event.description?.substring(0, 100) || 'No description'}...)`).join(', ')
      : 'None yet';

    const prompt = `
      Analyze this book content and suggest NEW timeline events that would enhance the story's chronology and depth.

      Book Content:
      ${combinedContent}

      These are the current timeline events, do not make suggestions based on these, create new events.
      Current timeline events: [${existingEventsList}]

      CRITICAL REQUIREMENTS:
      1. **CREATE COMPLETELY NEW EVENTS**: Do not suggest anything similar to the existing timeline events listed above
      2. Focus on events that are mentioned or implied but not yet tracked
      3. Consider both past events (backstory) and current plot events
      4. Ensure each event contributes to character or world development

      Event Types:
      - historical: Major world events, wars, disasters, founding of cities/kingdoms
      - personal: Character backstory events, births, deaths, relationships
      - plot_event: Current story events, meetings, discoveries, conflicts

      For each timeline event suggestion, provide:
      1. A clear, descriptive title
      2. Detailed description of what happened
      3. Event type (historical, personal, plot_event)
      4. Approximate date or time reference (if mentioned in text)
      5. Reasoning for why this event should be tracked
      6. Confidence score (0.0-1.0)

      Focus on events that:
      - Provide important backstory context
      - Explain current world state or character motivations
      - Are referenced multiple times in the text
      - Create interesting connections between characters or locations
      - Support major plot developments

      Return a JSON array with this exact structure:
      [
        {
          "title": "Event Title",
          "description": "Detailed description of what happened",
          "eventType": "historical|personal|plot_event",
          "eventDate": "Approximate date or time reference if available",
          "reasoning": "Why this event is important to track",
          "confidence": 0.85
        }
      ]

      Limit to 5 most important timeline suggestions.
      Ensure the JSON is valid and parseable.
    `;

    try {
      const response = await this.callOpenAI(prompt, bookId);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs
      const timelineSuggestions: TimelineEventSuggestion[] = suggestions.slice(0, 5).map((suggestion, index) => ({
        id: `timeline_${Date.now()}_${index}`,
        title: suggestion.title || 'Untitled Event',
        description: suggestion.description || 'No description provided',
        eventType: suggestion.eventType || 'plot_event',
        eventDate: suggestion.eventDate || '',
        reasoning: suggestion.reasoning || '',
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5
      }));

      console.log(`📅 Timeline Agent: Generated ${timelineSuggestions.length} suggestions`);
      return timelineSuggestions;
    } catch (error) {
      console.error('Timeline Agent error:', error);
      return [];
    }
  }
}
