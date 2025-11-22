"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sparkles, Check, X, Loader2, Film, AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface SceneCardSuggestion {
  id: string;
  title: string;
  description: string;
  purpose?: string;
  conflict?: string;
  outcome?: string;
  reasoning: string;
  confidence: number;
}

interface AISceneSuggestionsProps {
  bookId: string;
  onSuggestionAccepted?: (suggestion: SceneCardSuggestion) => void;
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
export async function clearSceneCache(bookId: string) {
  try {
    await fetch(`/api/books/${bookId}/book-planning-cache`, { method: 'DELETE' });
    console.log('🗑️ Cleared scene cache for book:', bookId);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

export function AISceneSuggestions({ bookId, onSuggestionAccepted, className }: AISceneSuggestionsProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<SceneCardSuggestion[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = React.useState<Set<string>>(new Set())
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = React.useState(false)
  const [creatingSuggestions, setCreatingSuggestions] = React.useState<Set<string>>(new Set())
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
    console.log('💾 Cached context in Redis (hash:', contentHash.substring(0, 8) + ')');
    
    try {
      await fetch(`/api/books/${bookId}/book-planning-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, contentHash })
      });
      console.log('✅ Context saved to Redis successfully');
    } catch (error) {
      console.error('❌ Failed to save context to Redis:', error);
    }
  };

  const handleAnalyze = async (isAnalyzeMore: boolean = false) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      // Try to get cached context
      const cachedContext = await getCachedContext();
      
      console.log('🤖 Calling AI scene analyze API...');
      console.log('📊 Request config:', {
        bookId,
        isAnalyzeMore,
        existingSuggestionsCount: suggestions.length,
        skipVectorSearch: !!cachedContext
      });

      const response = await fetch(`/api/books/${bookId}/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'scenes',
          options: {
            maxSuggestions: 5,
            existingSuggestions: isAnalyzeMore 
              ? [...Array.from(acceptedSuggestions).map(id => suggestions.find(s => s.id === id)).filter(Boolean),
                 ...suggestions.filter(s => !acceptedSuggestions.has(s.id))]
              : [],
            cachedContext,
            skipVectorSearch: !!cachedContext,
            customIdea: customIdea.trim() || undefined
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Scene AI response received:', {
        isAnalyzeMore,
        hasContext: !!data.context,
        contextLength: data.context?.length || 0,
        suggestionsCount: data.suggestions?.length || 0,
        usedCache: data.metadata?.usedCache
      });
      
      if (isAnalyzeMore) {
        // For "Analyze More", append new suggestions
        setSuggestions(prev => [...prev, ...(data.suggestions || [])]);
      } else {
        // For initial analysis, replace suggestions
        setSuggestions(data.suggestions || []);
      }

      // 💰 CRITICAL: Save context to Redis if we have fresh context
      if (data.context && !data.metadata?.usedCache) {
        console.log('💾 Saving fresh planning context to Redis...');
        await setCachedContext(data.context);
        console.log('✅ Context saved to Redis successfully');
      } else if (data.metadata?.usedCache) {
        console.log('⚡ Used cached context - no need to save to Redis');
      }
    } catch (error) {
      console.error('Error analyzing characters:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSelection = (suggestionId: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
      } else {
        newSet.add(suggestionId);
      }
      return newSet;
    });
  };

  const handleConfirmSelected = async () => {
    if (selectedSuggestions.size === 0) return;

    setIsCreating(true);
    setError(null);

    try {
      const selectedScenes = suggestions.filter(s => selectedSuggestions.has(s.id));
      let createdCount = 0;
      
      console.log(`🎬 Creating ${selectedScenes.length} scene cards...`);
      for (const suggestion of selectedScenes) {
        // Mark this suggestion as being created
        setCreatingSuggestions(prev => new Set([...prev, suggestion.id]))
        
        try {
          console.log(`📝 Creating scene: ${suggestion.title}`);
        const response = await fetch(`/api/books/${bookId}/scene-cards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: suggestion.title,
            description: suggestion.description,
            purpose: suggestion.purpose || '',
            conflict: suggestion.conflict || '',
            outcome: suggestion.outcome || ''
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ Failed to create scene: ${suggestion.title}`, errorData);
          throw new Error(`Failed to create scene card: ${suggestion.title}`);
        }

          console.log(`✅ Created scene: ${suggestion.title}`);
          createdCount++;

          // Mark as accepted
          setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]));
        } catch (error) {
          console.error(`❌ Error creating scene: ${suggestion.title}`, error);
          throw error; // Re-throw to be caught by outer try-catch
        } finally {
          // Remove from creating set
          setCreatingSuggestions(prev => {
            const newSet = new Set(prev);
            newSet.delete(suggestion.id);
            return newSet;
          });
        }
      }

      console.log(`✅ Successfully created ${createdCount} scene cards`);

      // Clear selections
      setSelectedSuggestions(new Set());

      // Update Redis cache with new scenes
      console.log('🔄 Updating Redis cache with new scenes...');
      try {
        const cacheResponse = await fetch(`/api/books/${bookId}/book-planning-cache`);
        if (cacheResponse.ok) {
          const cacheData = await cacheResponse.json();
          if (cacheData.cached && cacheData.context) {
            let updatedContext = cacheData.context;
            
            // Build the new scenes text
            const newScenesText = selectedScenes.map((scene, i) => 
              `${i + 1}. ${scene.title}: ${scene.description.substring(0, 100)}${scene.description.length > 100 ? '...' : ''}`
            ).join('\n');
            
            // Find the SCENES section and update it
            const sceneSectionMatch = updatedContext.match(/🎬 SCENE CARDS \((\d+) total\):/);
            if (sceneSectionMatch) {
              const currentCount = parseInt(sceneSectionMatch[1]);
              const newCount = currentCount + createdCount;
              
              const sceneStart = updatedContext.indexOf('🎬 SCENE CARDS');
              const nextSectionStart = updatedContext.indexOf('\n\n', sceneStart + 1);
              
              if (nextSectionStart !== -1) {
                const beforeScenes = updatedContext.substring(0, nextSectionStart);
                const afterScenes = updatedContext.substring(nextSectionStart);
                updatedContext = `${beforeScenes}\n${newScenesText}${afterScenes}`;
                updatedContext = updatedContext.replace(
                  `🎬 SCENE CARDS (${currentCount} total):`,
                  `🎬 SCENE CARDS (${newCount} total):`
                );
              } else {
                updatedContext = `${updatedContext}\n${newScenesText}`;
                updatedContext = updatedContext.replace(
                  `🎬 SCENE CARDS (${currentCount} total):`,
                  `🎬 SCENE CARDS (${newCount} total):`
                );
              }
            } else {
              updatedContext += `\n\n🎬 SCENE CARDS (${createdCount} total):\n${newScenesText}`;
            }
            
            // Save updated context back to Redis
            await fetch(`/api/books/${bookId}/book-planning-cache`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                context: updatedContext, 
                contentHash: cacheData.contentHash 
              })
            });
            console.log('✅ Cache updated successfully with new scenes');
          } else {
            console.log('⚠️ No cache found, will rebuild on next analysis');
          }
        }
      } catch (cacheError) {
        console.warn('Failed to update cache, will rebuild on next analysis:', cacheError);
      }

      // Notify parent component
      if (onSuggestionAccepted && selectedScenes.length > 0) {
        onSuggestionAccepted(selectedScenes[0]); // Trigger refresh
      }
    } catch (error) {
      console.error('Error creating scene cards:', error);
      setError(error instanceof Error ? error.message : 'Failed to create scene cards');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing while creating scenes
      if (!open && isCreating) return;
      setIsOpen(open);
    }}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn("gap-2", className)}
        >
          <Sparkles className="h-4 w-4" />
          AI Scene Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            AI Scene Card Suggestions
          </DialogTitle>
          <DialogDescription>
            Let AI analyze your story and suggest scene cards for important scenes that need detailed planning.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2" ref={scrollContainerRef}>
          {error && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-2 text-red-800">
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Analysis Error</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {suggestions.length === 0 && !isAnalyzing && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <Film className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Ready to discover key scenes</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Optionally provide a scene idea, or let AI analyze your story automatically
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="custom-scene-idea">Scene Idea (Optional)</Label>
                    <Textarea
                      id="custom-scene-idea"
                      placeholder="e.g., A confrontation between the protagonist and antagonist in the final battle, or A quiet moment where the hero discovers a crucial clue..."
                      value={customIdea}
                      onChange={(e) => setCustomIdea(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  
                  <Button 
                    onClick={() => handleAnalyze(false)} 
                    disabled={isAnalyzing}
                    className="gap-2 w-full"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isAnalyzing ? 'Analyzing...' : 'Generate Suggestions'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-4">
              {suggestions.map((suggestion) => {
                const isAccepted = acceptedSuggestions.has(suggestion.id);
                const isSelected = selectedSuggestions.has(suggestion.id);
                return (
                  <Card 
                    key={suggestion.id} 
                    className={cn(
                      "transition-all cursor-pointer hover:border-primary/50",
                      isAccepted && "opacity-60 border-green-200 bg-green-50/50",
                      isSelected && !isAccepted && "border-primary bg-primary/5"
                    )}
                    onClick={() => !isAccepted && toggleSelection(suggestion.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {!isAccepted && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(suggestion.id)}
                              onClick={(e) => e.stopPropagation()}
                              disabled={creatingSuggestions.has(suggestion.id) || isCreating}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{suggestion.title}</CardTitle>
                            <div className="flex flex-wrap gap-2 mb-2 items-center">
                              <Badge variant="outline" className="ml-auto">
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {creatingSuggestions.has(suggestion.id) && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 flex-shrink-0">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Saving...
                          </Badge>
                        )}
                        {isAccepted && !creatingSuggestions.has(suggestion.id) && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 flex-shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      </div>

                      {suggestion.purpose && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Purpose</h4>
                          <p className="text-sm text-muted-foreground">{suggestion.purpose}</p>
                        </div>
                      )}

                      {suggestion.conflict && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Conflict</h4>
                          <p className="text-sm text-muted-foreground">{suggestion.conflict}</p>
                        </div>
                      )}

                      {suggestion.outcome && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Outcome</h4>
                          <p className="text-sm text-muted-foreground">{suggestion.outcome}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium text-sm mb-2">Why this scene?</h4>
                        <p className="text-sm text-muted-foreground italic">{suggestion.reasoning}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {isAnalyzing && (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
                <p className="text-lg font-medium mb-2">Analyzing your story...</p>
                <p className="text-sm text-muted-foreground">
                  AI is reviewing your book's content to suggest relevant scene cards
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t">
          {(suggestions.length > 0 || isAnalyzing) && (
            <div className="space-y-2">
              <Label htmlFor="custom-scene-idea-bottom" className="text-sm">Scene Idea (Optional)</Label>
              <Textarea
                id="custom-scene-idea-bottom"
                placeholder="e.g., A confrontation between the protagonist and antagonist..."
                value={customIdea}
                onChange={(e) => setCustomIdea(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {suggestions.length > 0 && (
                <span>
                  {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} · {selectedSuggestions.size} selected · {acceptedSuggestions.size} accepted
                </span>
              )}
            </div>
            <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleAnalyze(true)}
              disabled={isAnalyzing || isCreating || suggestions.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isAnalyzing ? 'Analyzing...' : 'Analyze More'}
            </Button>
            {selectedSuggestions.size > 0 && (
              <Button
                onClick={handleConfirmSelected}
                disabled={isCreating || isAnalyzing}
                className="gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm Selected ({selectedSuggestions.size})
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isCreating}
            >
              Done
            </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

