"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Check, X, Loader2, Brain, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrainstormingSuggestion {
  id: string;
  title: string;
  content: string;
  reasoning: string;
  tags: string[];
  confidence: number;
  relatedChapters: string[];
}

interface AISuggestionsProps {
  bookId: string;
  onSuggestionAccepted?: (suggestion: BrainstormingSuggestion) => void;
  className?: string;
}

// Redis-based caching utilities

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
export async function clearBrainstormingCache(bookId: string) {
  try {
    await fetch(`/api/books/${bookId}/brainstorm-cache`, { method: 'DELETE' });
    console.log('🗑️ Cleared brainstorming cache for book:', bookId);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

export function AISuggestions({ bookId, onSuggestionAccepted, className }: AISuggestionsProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<BrainstormingSuggestion[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<Set<string>>(new Set())
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  
  // Get cached context from Redis, checking content hash
  const getCachedContext = async () => {
    console.log('🔍 Checking Redis cache for bookId:', bookId);
    
    try {
      const response = await fetch(`/api/books/${bookId}/brainstorm-cache`);
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
        await fetch(`/api/books/${bookId}/brainstorm-cache`, { method: 'DELETE' });
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
      await fetch(`/api/books/${bookId}/brainstorm-cache`, {
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
        content: s.content.substring(0, 150)
      }))

      // Check global cache first (async now due to content hash check)
      const cachedContext = await getCachedContext();
      const willUseCache = cachedContext !== null;
      
      if (willUseCache) {
        console.log('✅ USING GLOBAL CACHE - Skipping expensive vector search!');
      } else {
        console.log('❌ NO CACHE - Will perform full vector search');
      }
      
      console.log(`🔄 Analysis request:`, {
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
          type: 'brainstorming',
          options: {
            maxSuggestions: 5,
            existingSuggestions: isAnalyzeMore ? existingSuggestions : [],
            cachedContext: cachedContext, // Always pass cached context if available
            skipVectorSearch: willUseCache // Skip expensive database fetch if we have cache
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      
      console.log('📥 Received response:', {
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
          ? 'No additional suggestions could be generated. The AI has explored all available ideas.'
          : 'No suggestions were generated. Try adding more content to your book chapters.')
      }
    } catch (error) {
      console.error('AI analysis error:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze book content')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAcceptSuggestion = async (suggestion: BrainstormingSuggestion) => {
    try {
      // Create brainstorming note from suggestion
      const response = await fetch(`/api/books/${bookId}/brainstorming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          content: suggestion.content,
          tags: [...suggestion.tags, 'ai-generated']
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create brainstorming note')
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
      console.error('Error accepting suggestion:', error)
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

  const remainingSuggestions = suggestions.filter(s => !acceptedSuggestions.has(s.id))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)} onClick={() => {
          console.log('Opening AI Suggestions modal, isAnalyzing:', isAnalyzing);
          setIsOpen(true);
        }}>
          <Sparkles className="h-4 w-4" />
          AI Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="!max-w-none max-h-[90vh] flex flex-col" 
        style={{ width: '70vw', maxWidth: 'none' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Brainstorming Suggestions
          </DialogTitle>
          <DialogDescription>
            Get AI-powered brainstorming suggestions based on your book content
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-4">
          {!isAnalyzing && suggestions.length === 0 && !error && (
            <Card className="text-center py-8">
              <CardContent>
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready to Generate Ideas</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Analyze Book" to get AI-powered brainstorming suggestions based on your chapters
                </p>
                <Button onClick={() => handleAnalyze(false)} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Analyze Book
                </Button>
              </CardContent>
            </Card>
          )}

          {isAnalyzing && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="relative inline-block mb-6">
                  <Brain className="h-16 w-16 text-purple-500 mx-auto animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Analyzing Your Book</h3>
                <p className="text-muted-foreground mb-4">
                  Exploring comprehensive context across chapters, characters, locations, plot, timeline, scenes, and research...
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce"></div>
                </div>
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
                  Suggested Brainstorming Topics ({remainingSuggestions.length})
                </h3>
                {suggestions.length > remainingSuggestions.length && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    {acceptedSuggestions.size} accepted
                  </Badge>
                )}
              </div>

              {remainingSuggestions.map((suggestion) => (
                <Card key={suggestion.id} className="border-2 transition-colors hover:border-purple-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                          >
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                          {suggestion.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
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
                      <h4 className="font-medium text-sm mb-2">Brainstorming Content:</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {suggestion.content}
                      </p>
                    </div>
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
                  You've processed all AI suggestions. Check your brainstorming notes to see the accepted ideas.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {suggestions.length > 0 && remainingSuggestions.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
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
        )}
      </DialogContent>
    </Dialog>
  )
}
