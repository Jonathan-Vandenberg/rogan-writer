"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sparkles, Check, X, Loader2, Calendar, AlertCircle, User, MapPin, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Character, Location } from "@prisma/client"

interface TimelineEventSuggestion {
  id: string;
  title: string;
  description: string;
  eventType: 'historical' | 'personal' | 'plot_event';
  eventDate?: string;
  startTime: number;
  endTime: number;
  characterName?: string;
  locationName?: string;
  reasoning: string;
  confidence: number;
}

interface AITimelineSuggestionsProps {
  bookId: string;
  characters: Character[];
  locations: Location[];
  onSuggestionAccepted?: (suggestion: TimelineEventSuggestion) => void;
  className?: string;
}

// Generate a simple hash of book content to detect changes
async function getBookContentHash(bookId: string): Promise<string> {
  try {
    const response = await fetch(`/api/books/${bookId}/content-hash`);
    if (response.ok) {
      const data = await response.json();
      return data.hash;
    }
  } catch (error) {
    console.warn('Could not fetch content hash');
  }
  return Date.now().toString(); // Fallback to timestamp
}

// Utility to clear cache for a specific book (call this when book content changes)
export async function clearTimelineCache(bookId: string) {
  try {
    await fetch(`/api/books/${bookId}/book-planning-cache`, { method: 'DELETE' });
    console.log('🗑️ Cleared timeline cache for book:', bookId);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

export function AITimelineSuggestions({ bookId, characters, locations, onSuggestionAccepted, className }: AITimelineSuggestionsProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<TimelineEventSuggestion[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<Set<string>>(new Set())
  const [customIdea, setCustomIdea] = React.useState("")
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  
  // Get cached context from Redis, checking content hash
  const getCachedContext = async () => {
    console.log('🔍 Checking Redis cache for bookId:', bookId);
    
    try {
      const response = await fetch(`/api/books/${bookId}/book-planning-cache`);
      if (!response.ok) {
        console.log('❌ No Redis cache found');
        return null;
      }

      const data = await response.json();
      if (!data.cached) {
        console.log('❌ No cache entry found for this book');
        return null;
      }

      console.log('✓ Redis cache entry found! Age:', data.age, 'seconds');
      
      // Check if book content has changed
      const currentHash = await getBookContentHash(bookId);
      console.log('🔑 Hash check - Cached:', data.contentHash.substring(0, 8), '| Current:', currentHash.substring(0, 8));
      
      if (data.contentHash !== currentHash) {
        console.log('🔄 Book content changed - invalidating cache');
        await fetch(`/api/books/${bookId}/book-planning-cache`, { method: 'DELETE' });
        return null;
      }
      
      console.log('✓ Content hash matches!');
      console.log('📦 Retrieved cached context from Redis (age:', data.age, 'seconds)');
      return data.context;
    } catch (error) {
      console.error('Error fetching Redis cache:', error);
      return null;
    }
  };
  
  const setCachedContext = async (context: string) => {
    const contentHash = await getBookContentHash(bookId);
    try {
      await fetch(`/api/books/${bookId}/book-planning-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, contentHash })
      });
      console.log('💾 Cached context in Redis (hash:', contentHash.substring(0, 8) + ')');
    } catch (error) {
      console.error('Error caching to Redis:', error);
    }
  };

  const handleAnalyze = async (isAnalyzeMore = false) => {
    setIsAnalyzing(true)
    setError(null)
    
    // Only clear suggestions if it's the first analysis
    if (!isAnalyzeMore) {
      setSuggestions([])
    }

    try {
      // Include existing suggestions in the request to avoid duplicates
      const existingSuggestions = suggestions.map(s => ({
        title: s.title,
        description: s.description.substring(0, 150)
      }))

      // Check global cache first (async now due to content hash check)
      const cachedContext = await getCachedContext();
      const willUseCache = cachedContext !== null;
      
      if (willUseCache) {
        console.log('✅ USING GLOBAL CACHE - Skipping expensive vector search!');
      } else {
        console.log('❌ NO CACHE - Will perform full vector search');
      }
      
      console.log(`🔄 Timeline analysis request:`, {
        isAnalyzeMore,
        hasCachedContext: cachedContext !== null,
        cacheAge: cachedContext ? 'from global cache' : 'none',
        willSkipVectorSearch: willUseCache,
        existingSuggestionsCount: existingSuggestions.length
      });

      const response = await fetch(`/api/books/${bookId}/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'timeline',
          options: {
            maxSuggestions: 5,
            existingSuggestions: isAnalyzeMore ? existingSuggestions : [],
            cachedContext: cachedContext, // Always pass cached context if available
            skipVectorSearch: willUseCache, // Skip expensive database fetch if we have cache
            customIdea: customIdea.trim() || undefined
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      
      console.log('📥 Received timeline response:', {
        isAnalyzeMore,
        hasContext: !!data.context,
        contextLength: data.context?.length,
        suggestionsCount: data.suggestions?.length,
        usedCache: data.metadata?.usedCache
      });
      
      // Always save context if it's returned (either fresh or updated)
      if (data.context && !data.metadata?.usedCache) {
        console.log('💾 Saving fresh planning context to Redis...');
        await setCachedContext(data.context);
        console.log('✅ Context saved to Redis successfully');
      } else if (data.metadata?.usedCache) {
        console.log('⚡ Used cached context - saved time & money!');
      } else {
        console.log('⚠️ No context to save:', { hasContext: !!data.context, usedCache: data.metadata?.usedCache });
      }
      
      if (isAnalyzeMore) {
        // Append new suggestions to the bottom
        setSuggestions(prev => [...prev, ...(data.suggestions || [])])
        // Scroll to bottom after state updates
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: 'smooth'
            })
          }
        }, 100)
      } else {
        setSuggestions(data.suggestions || [])
      }
      
      if (data.suggestions?.length === 0) {
        setError(isAnalyzeMore 
          ? 'No additional timeline events could be generated. The AI has explored all available ideas.'
          : 'No timeline events were generated. Try adding more content to your book chapters.')
      }
    } catch (error) {
      console.error('AI timeline analysis error:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze book content')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Check for conflicts: same character at different locations at overlapping times
  const checkForConflicts = async (suggestion: TimelineEventSuggestion): Promise<string | null> => {
    if (!suggestion.characterName) {
      return null; // No character, no conflict possible
    }

    try {
      // Fetch existing timeline events to check for conflicts
      const response = await fetch(`/api/books/${bookId}/timeline-events`);
      if (!response.ok) {
        return null; // Can't check, proceed anyway
      }

      const existingEvents = await response.json();
      const characterId = characters.find(c => c.name === suggestion.characterName)?.id;
      
      if (!characterId) {
        return null; // Character not found, no conflict
      }

      // Check for overlapping events with the same character at different locations
      const conflictingEvent = existingEvents.find((event: any) => {
        // Same character
        if (event.characterId !== characterId) {
          return false;
        }

        // Different location (or one has location and other doesn't)
        const eventLocationId = event.locationId;
        const suggestionLocationId = suggestion.locationName 
          ? locations.find(l => l.name === suggestion.locationName)?.id
          : null;

        // If both have locations and they're different, or one has location and other doesn't
        if (eventLocationId && suggestionLocationId && eventLocationId !== suggestionLocationId) {
          // Check if times overlap
          const timesOverlap = !(
            suggestion.endTime < event.startTime || 
            suggestion.startTime > event.endTime
          );
          return timesOverlap;
        }

        return false;
      });

      if (conflictingEvent) {
        const conflictLocation = locations.find(l => l.id === conflictingEvent.locationId)?.name || 'Unknown';
        const suggestionLocation = suggestion.locationName || 'No location';
        return `Conflict detected: ${suggestion.characterName} is already at "${conflictLocation}" during time ${conflictingEvent.startTime}-${conflictingEvent.endTime}, but this event places them at "${suggestionLocation}" during overlapping time ${suggestion.startTime}-${suggestion.endTime}.`;
      }

      return null; // No conflict
    } catch (error) {
      console.warn('Error checking for conflicts:', error);
      return null; // Proceed anyway if check fails
    }
  }

  const handleAcceptSuggestion = async (suggestion: TimelineEventSuggestion) => {
    try {
      // Check for conflicts first
      const conflictMessage = await checkForConflicts(suggestion);
      if (conflictMessage) {
        const proceed = confirm(`${conflictMessage}\n\nDo you want to proceed anyway?`);
        if (!proceed) {
          return;
        }
      }

      // Find character and location IDs from names
      const characterId = suggestion.characterName 
        ? characters.find(c => c.name === suggestion.characterName)?.id || null
        : null;
      
      const locationId = suggestion.locationName 
        ? locations.find(l => l.name === suggestion.locationName)?.id || null
        : null;

      // Create timeline event from suggestion
      const response = await fetch(`/api/books/${bookId}/timeline-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          eventDate: suggestion.eventDate || null,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime,
          characterId: characterId,
          locationId: locationId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create timeline event')
      }

      // Mark as accepted
      setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]))
      
      // Notify parent component
      onSuggestionAccepted?.(suggestion)

      // Auto-close dialog if all suggestions are accepted
      if (acceptedSuggestions.size + 1 >= suggestions.length) {
        setTimeout(() => setIsOpen(false), 1500)
      }
    } catch (error) {
      console.error('Error accepting timeline suggestion:', error)
      alert('Failed to accept suggestion. Please try again.')
    }
  }

  const handleRejectSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-50"
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-50"
    return "text-orange-600 bg-orange-50"
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'historical':
        return "bg-purple-100 text-purple-700"
      case 'personal':
        return "bg-blue-100 text-blue-700"
      case 'plot_event':
        return "bg-green-100 text-green-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const remainingSuggestions = suggestions.filter(s => !acceptedSuggestions.has(s.id))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className={cn("gap-2", className)} onClick={() => {
          console.log('Opening AI Timeline Suggestions modal, isAnalyzing:', isAnalyzing);
          setIsOpen(true);
        }}>
          <Sparkles className="h-4 w-4" />
          AI Timeline Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="!max-w-7xl max-h-[90vh] flex flex-col" 
        style={{ width: '70vw', maxWidth: 'none' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-500" />
            AI Timeline Event Suggestions
          </DialogTitle>
          <DialogDescription>
            Get AI-powered timeline event suggestions with character and location assignments
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-4">
          {!isAnalyzing && suggestions.length === 0 && !error && (
            <Card className="py-8">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ready to Generate Timeline Events</h3>
                    <p className="text-muted-foreground mb-4">
                      Optionally provide a timeline idea, or let AI analyze your book automatically to suggest events
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="custom-timeline-idea">Timeline Idea (Optional)</Label>
                    <Textarea
                      id="custom-timeline-idea"
                      placeholder="e.g., Create a series of events showing the protagonist's journey from home to the capital, or Develop a timeline of the ancient war that shaped the current world..."
                      value={customIdea}
                      onChange={(e) => setCustomIdea(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  
                  <Button onClick={() => handleAnalyze(false)} className="gap-2 w-full">
                    <Sparkles className="h-4 w-4" />
                    Analyze Book
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isAnalyzing && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="relative inline-block mb-6">
                  <Calendar className="h-16 w-16 text-green-500 mx-auto animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Analyzing Your Book</h3>
                <p className="text-muted-foreground mb-4">Exploring your content and generating timeline event suggestions...</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-800 mb-1">Analysis Failed</h3>
                    <p className="text-red-700 text-sm mb-3">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => handleAnalyze(false)}>
                      Try Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {remainingSuggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Suggested Timeline Events ({remainingSuggestions.length})
                </h3>
                {suggestions.length > remainingSuggestions.length && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    {acceptedSuggestions.size} accepted
                  </Badge>
                )}
              </div>

              {remainingSuggestions.map((suggestion) => (
                <Card key={suggestion.id} className="border-2 transition-colors hover:border-green-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                          >
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getEventTypeColor(suggestion.eventType))}
                          >
                            {suggestion.eventType}
                          </Badge>
                          <Badge variant="outline" className="text-xs gap-1">
                            <Clock className="h-3 w-3" />
                            Time {suggestion.startTime}-{suggestion.endTime}
                          </Badge>
                          {suggestion.characterName && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <User className="h-3 w-3" />
                              {suggestion.characterName}
                            </Badge>
                          )}
                          {suggestion.locationName && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <MapPin className="h-3 w-3" />
                              {suggestion.locationName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptSuggestion(suggestion)}
                          className="gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Event Description:</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {suggestion.description}
                      </p>
                    </div>
                    {suggestion.eventDate && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">In-Story Date:</h4>
                        <p className="text-sm font-mono text-muted-foreground">
                          {suggestion.eventDate}
                        </p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Why This Matters:</h4>
                      <p className="text-xs text-muted-foreground italic">
                        {suggestion.reasoning}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {suggestions.length > 0 && remainingSuggestions.length === 0 && (
            <Card className="border-green-200 bg-green-50 text-center py-6">
              <CardContent>
                <Check className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 mb-1">All Done!</h3>
                <p className="text-green-700 text-sm">
                  You've processed all AI suggestions. Check your timeline to see the accepted events.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {suggestions.length > 0 && remainingSuggestions.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="custom-timeline-idea-bottom" className="text-sm">Timeline Idea (Optional)</Label>
              <Textarea
                id="custom-timeline-idea-bottom"
                placeholder="e.g., Create events showing the protagonist's journey..."
                value={customIdea}
                onChange={(e) => setCustomIdea(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={() => handleAnalyze(true)} 
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze More
                  </>
                )}
              </Button>
              <div className="text-sm text-muted-foreground">
                {remainingSuggestions.length} suggestions generated
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

