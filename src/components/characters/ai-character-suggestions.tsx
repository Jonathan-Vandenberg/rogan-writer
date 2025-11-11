"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Check, X, Loader2, Users, AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface CharacterSuggestion {
  id: string;
  name: string;
  description: string;
  role: 'PROTAGONIST' | 'ANTAGONIST' | 'MAJOR' | 'MINOR' | 'CAMEO';
  traits: string[];
  backstory: string;
  reasoning: string;
  confidence: number;
}

interface AICharacterSuggestionsProps {
  bookId: string;
  onSuggestionAccepted?: (suggestion: CharacterSuggestion) => void;
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
export async function clearCharacterCache(bookId: string) {
  try {
    await fetch(`/api/books/${bookId}/book-planning-cache`, { method: 'DELETE' });
    console.log('🗑️ Cleared character cache for book:', bookId);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

export function AICharacterSuggestions({ bookId, onSuggestionAccepted, className }: AICharacterSuggestionsProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<CharacterSuggestion[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = React.useState<Set<string>>(new Set())
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = React.useState(false)
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
      
      console.log('🤖 Calling AI character analyze API...');
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
          type: 'characters',
          options: {
            maxSuggestions: 5,
            existingSuggestions: isAnalyzeMore 
              ? [...Array.from(acceptedSuggestions).map(id => suggestions.find(s => s.id === id)).filter(Boolean),
                 ...suggestions.filter(s => !acceptedSuggestions.has(s.id))]
              : [],
            cachedContext,
            skipVectorSearch: !!cachedContext
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Character AI response received:', {
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
      const selectedCharacters = suggestions.filter(s => selectedSuggestions.has(s.id));
      
      for (const suggestion of selectedCharacters) {
        const response = await fetch(`/api/books/${bookId}/characters`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: suggestion.name,
            description: suggestion.description,
            role: suggestion.role,
            personality: suggestion.traits.join(', '),
            backstory: suggestion.backstory
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create character: ${suggestion.name}`);
        }

        // Mark as accepted
        setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]));
      }

      // Clear selections
      setSelectedSuggestions(new Set());

      // Update Redis cache with new characters
      console.log('🔄 Updating Redis cache with new characters...');
      try {
        const cacheResponse = await fetch(`/api/books/${bookId}/book-planning-cache`);
        if (cacheResponse.ok) {
          const cacheData = await cacheResponse.json();
          if (cacheData.cached && cacheData.context) {
            let updatedContext = cacheData.context;
            
            // Build the new characters text
            const newCharactersText = selectedCharacters.map((char, i) => 
              `${i + 1}. ${char.name} (${char.role || 'No role'}): ${char.description.substring(0, 100)}${char.description.length > 100 ? '...' : ''}`
            ).join('\n');
            
            // Find the CHARACTERS section and update it
            const characterSectionMatch = updatedContext.match(/👥 CHARACTERS \((\d+) total\):/);
            if (characterSectionMatch) {
              const currentCount = parseInt(characterSectionMatch[1]);
              const newCount = currentCount + selectedCharacters.length;
              
              const characterStart = updatedContext.indexOf('👥 CHARACTERS');
              const nextSectionStart = updatedContext.indexOf('\n\n', characterStart + 1);
              
              if (nextSectionStart !== -1) {
                const beforeCharacters = updatedContext.substring(0, nextSectionStart);
                const afterCharacters = updatedContext.substring(nextSectionStart);
                updatedContext = `${beforeCharacters}\n${newCharactersText}${afterCharacters}`;
                updatedContext = updatedContext.replace(
                  `👥 CHARACTERS (${currentCount} total):`,
                  `👥 CHARACTERS (${newCount} total):`
                );
              } else {
                updatedContext = `${updatedContext}\n${newCharactersText}`;
                updatedContext = updatedContext.replace(
                  `👥 CHARACTERS (${currentCount} total):`,
                  `👥 CHARACTERS (${newCount} total):`
                );
              }
            } else {
              updatedContext += `\n\n👥 CHARACTERS (${selectedCharacters.length} total):\n${newCharactersText}`;
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
            console.log('✅ Cache updated successfully with new characters');
          } else {
            console.log('⚠️ No cache found, will rebuild on next analysis');
          }
        }
      } catch (cacheError) {
        console.warn('Failed to update cache, will rebuild on next analysis:', cacheError);
      }

      // Notify parent component
      if (onSuggestionAccepted) {
        onSuggestionAccepted(selectedCharacters[0]); // Trigger refresh
      }
    } catch (error) {
      console.error('Error creating characters:', error);
      setError(error instanceof Error ? error.message : 'Failed to create characters');
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'PROTAGONIST':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ANTAGONIST':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MAJOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MINOR':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'CAMEO':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.charAt(0) + role.slice(1).toLowerCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn("gap-2", className)}
        >
          <Sparkles className="h-4 w-4" />
          AI Character Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            AI Character Suggestions
          </DialogTitle>
          <DialogDescription>
            Let AI analyze your story and suggest characters that could enhance your narrative.
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
              <CardContent className="pt-6 text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Ready to discover new characters</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Generate Suggestions" to let AI analyze your story and suggest characters
                </p>
                <Button 
                  onClick={() => handleAnalyze(false)} 
                  disabled={isAnalyzing}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isAnalyzing ? 'Analyzing...' : 'Generate Suggestions'}
                </Button>
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
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{suggestion.name}</CardTitle>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline" className={getRoleColor(suggestion.role)}>
                                {getRoleLabel(suggestion.role)}
                              </Badge>
                              {suggestion.traits.slice(0, 3).map((trait, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {trait}
                                </Badge>
                              ))}
                              <Badge variant="outline" className="ml-auto">
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {isAccepted && (
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

                      {suggestion.backstory && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Backstory</h4>
                          <p className="text-sm text-muted-foreground">{suggestion.backstory}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium text-sm mb-2">Why this character?</h4>
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
                  AI is reviewing your book's content to suggest relevant characters
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
}

