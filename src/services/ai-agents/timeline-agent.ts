import { Chapter } from '@prisma/client';
import { AIAgent } from './base-agent';
import { prisma } from '@/lib/db';
import { PlanningContextService } from '../planning-context.service';

export interface TimelineEventSuggestion {
  id: string;
  title: string;
  description: string;
  eventType: 'historical' | 'personal' | 'plot_event';
  eventDate?: string;
  startTime: number; // Start time unit (integer)
  endTime: number; // End time unit (integer)
  characterName?: string; // Suggested character name (will be matched to ID)
  locationName?: string; // Suggested location name (will be matched to ID)
  reasoning: string;
  confidence: number;
}

export class TimelineAgent extends AIAgent {
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
    console.log('📅 Timeline Agent: Starting analysis...');
    
    // Get book details and ALL existing timeline events with relations
    const [book, allExistingEvents, characters, locations] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: { title: true, description: true, genre: true }
      }),
      prisma.timelineEvent.findMany({
        where: { bookId },
        include: {
          character: { select: { name: true } },
          location: { select: { name: true } }
        },
        orderBy: { startTime: 'asc' }
      }),
      prisma.character.findMany({
        where: { bookId },
        select: { id: true, name: true, description: true, role: true }
      }),
      prisma.location.findMany({
        where: { bookId },
        select: { id: true, name: true, description: true }
      })
    ]);

    let planningContext: string;

    // 💰 OPTIMIZATION: Use cached planning data if available
    if (skipVectorSearch && cachedContext) {
      console.log('📅 ⚡ Using CACHED planning context - skipping database fetch to save time!');
      planningContext = cachedContext;
    } else {
      console.log('📅 📚 Fetching comprehensive planning data from database...');
      // Fetch all planning data directly from database using shared service
      planningContext = await PlanningContextService.buildPlanningContext(bookId);
    }
    
    // Build DETAILED existing timeline events context to avoid duplicates and conflicts
    const allExisting = [
      ...allExistingEvents.map(e => ({ 
        title: e.title, 
        description: e.description || '',
        startTime: e.startTime,
        endTime: e.endTime,
        character: e.character?.name,
        location: e.location?.name
      })),
      ...(existingSuggestions || []).map(s => ({ 
        title: s.title, 
        description: s.description || '',
        startTime: 0,
        endTime: 0,
        character: undefined,
        location: undefined
      }))
    ];
    
    const existingEventsList = allExisting.length > 0 
      ? allExisting.map((e, i) => 
          `${i + 1}. "${e.title}" (Time: ${e.startTime}-${e.endTime})${e.character ? ` [Character: ${e.character}]` : ''}${e.location ? ` [Location: ${e.location}]` : ''}\n   ${e.description.substring(0, 100)}...`
        ).join('\n\n')
      : 'None yet - fresh start!';

    // Build character and location lists for AI to reference
    const characterList = characters.length > 0
      ? characters.map(c => `- ${c.name} (${c.role || 'No role'}): ${c.description?.substring(0, 80) || 'No description'}...`).join('\n')
      : 'No characters created yet.';
    
    const locationList = locations.length > 0
      ? locations.map(l => `- ${l.name}: ${l.description?.substring(0, 80) || 'No description'}...`).join('\n')
      : 'No locations created yet.';

    // Calculate suggested time range based on existing events
    const maxExistingTime = allExistingEvents.length > 0 
      ? Math.max(...allExistingEvents.map(e => e.endTime || 1))
      : 0;
    const suggestedStartTime = maxExistingTime + 1;

    const prompt = `
      Analyze this book and suggest NEW timeline events that would enhance the story's chronology and create a good narrative flow.

      BOOK INFORMATION:
      Title: "${book?.title || 'Untitled'}"
      Description: "${book?.description || 'No description provided'}"
      Genre: ${book?.genre || 'Not specified'}

      COMPREHENSIVE PLANNING DATA (plots, timelines, characters, locations, brainstorms, scenes, research, chapter titles):
      ${planningContext}

      EXISTING TIMELINE EVENTS (DO NOT DUPLICATE - CREATE COMPLETELY NEW EVENTS):
      ${existingEventsList}

      AVAILABLE CHARACTERS (you can suggest these for events):
      ${characterList}

      AVAILABLE LOCATIONS (you can suggest these for events):
      ${locationList}

      ${customIdea ? `CUSTOM TIMELINE IDEA:\n${customIdea}\n\nUse this idea as the basis for timeline event suggestions.` : ''}

      CRITICAL REQUIREMENTS:
      1. **AVOID ALL DUPLICATES**: Carefully review existing events above. Do NOT suggest anything similar in theme, topic, or timing
      2. **CREATE GOOD STORY FLOW**: Even if the story hasn't been generated yet, suggest events that create a logical progression and narrative arc
      3. **CHARACTER-LOCATION CONSISTENCY**: If a character is assigned to an event, ensure they can logically be at that location at that time
      4. **NO CONFLICTS**: A character cannot be at two different locations at overlapping times. Check existing events for conflicts.
      5. **TIME PROGRESSION**: Events should progress forward in time. Suggested start time should be after existing events (current max: ${maxExistingTime}, suggest starting from ${suggestedStartTime})
      6. **OVERLAPPING IS OK**: Multiple events can overlap in time, but the same character cannot be at different places simultaneously
      7. **BE SPECIFIC**: Reference actual characters and locations from the book when possible

      Event Types:
      - historical: Major world events, wars, disasters, founding of cities/kingdoms
      - personal: Character backstory events, births, deaths, relationships, character development moments
      - plot_event: Current story events, meetings, discoveries, conflicts, plot progression

      For each timeline event suggestion, provide:
      1. A clear, descriptive title (2-6 words)
      2. Detailed description of what happens in this event (2-3 sentences)
      3. Event type (historical, personal, plot_event)
      4. Event date (in-story date/time reference if available, e.g., "Day 3", "Chapter 2", "May 8th")
      5. Start time (integer, should be >= ${suggestedStartTime} to avoid conflicts)
      6. End time (integer, should be >= startTime, can overlap with other events)
      7. Suggested character name (exact match from available characters list, or null if no character)
      8. Suggested location name (exact match from available locations list, or null if no location)
      9. Reasoning for why this event enhances the story
      10. Confidence score (0.0-1.0)

      Story Flow Guidelines:
      - Start with establishing events (world-building, character introductions)
      - Build tension through conflicts and discoveries
      - Include character development moments
      - Create connections between characters and locations
      - Progress toward climax and resolution
      - Consider pacing: mix fast-paced action with slower character moments

      Return a JSON array with this exact structure:
      [
        {
          "title": "Event Title",
          "description": "Detailed description of what happens in this event...",
          "eventType": "historical|personal|plot_event",
          "eventDate": "In-story date/time reference if available",
          "startTime": ${suggestedStartTime},
          "endTime": ${suggestedStartTime + 1},
          "characterName": "Exact character name from list or null",
          "locationName": "Exact location name from list or null",
          "reasoning": "Why this event enhances the story flow and chronology...",
          "confidence": 0.85
        }
      ]

      Limit to 5 most important timeline event suggestions.
      Ensure the JSON is valid and parseable.
      Make sure characterName and locationName exactly match names from the available lists, or use null.
    `;

    try {
      const response = await this.callOpenAI(prompt, bookId);
      const suggestions = this.cleanAndParseJSON(response);

      // Convert to our format with IDs and validate character/location matches
      const timelineSuggestions: TimelineEventSuggestion[] = suggestions.slice(0, 5).map((suggestion, index) => {
        // Match character name to ID
        let characterName: string | undefined = undefined;
        if (suggestion.characterName) {
          const matchedChar = characters.find(c => 
            c.name.toLowerCase() === suggestion.characterName.toLowerCase()
          );
          if (matchedChar) {
            characterName = matchedChar.name;
          } else {
            console.warn(`⚠️ Character "${suggestion.characterName}" not found, ignoring character assignment`);
          }
        }

        // Match location name to ID
        let locationName: string | undefined = undefined;
        if (suggestion.locationName) {
          const matchedLoc = locations.find(l => 
            l.name.toLowerCase() === suggestion.locationName.toLowerCase()
          );
          if (matchedLoc) {
            locationName = matchedLoc.name;
          } else {
            console.warn(`⚠️ Location "${suggestion.locationName}" not found, ignoring location assignment`);
          }
        }

        return {
          id: `timeline_${Date.now()}_${index}`,
          title: suggestion.title || 'Untitled Event',
          description: suggestion.description || 'No description provided',
          eventType: suggestion.eventType || 'plot_event',
          eventDate: suggestion.eventDate || undefined,
          startTime: typeof suggestion.startTime === 'number' ? Math.max(1, suggestion.startTime) : suggestedStartTime,
          endTime: typeof suggestion.endTime === 'number' ? Math.max(suggestion.startTime || suggestedStartTime, suggestion.endTime) : (suggestion.startTime || suggestedStartTime) + 1,
          characterName: characterName,
          locationName: locationName,
          reasoning: suggestion.reasoning || '',
          confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.5
        };
      });

      console.log(`📅 Timeline Agent: Generated ${timelineSuggestions.length} unique suggestions`);
      return {
        suggestions: timelineSuggestions,
        context: planningContext // Return planning context for caching
      };
    } catch (error) {
      console.error('Timeline Agent error:', error);
      return {
        suggestions: [],
        context: planningContext || ''
      };
    }
  }
}
