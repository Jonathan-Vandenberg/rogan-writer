"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Check, X, Loader2, Target, AlertCircle, AlertTriangle, Clock, User, Globe, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlotPointType } from "@prisma/client"

interface ConsistencyIssue {
  type: 'timeline' | 'character_state' | 'world_building' | 'logic';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedPlotPoint: {
    id: string;
    subplot: string;
    type: string;
    title: string;
  };
  suggestedFix: {
    newTitle?: string;
    newDescription?: string;
    reasoning: string;
  };
}

interface CharacterSuggestion {
  name: string;
  description: string;
  role: string;
  traits?: string[];
  backstory?: string;
  reasoning: string;
  confidence: number;
}

interface LocationSuggestion {
  name: string;
  description: string;
  geography?: string;
  culture?: string;
  reasoning: string;
  confidence: number;
}

interface CrossModuleEntities {
  characters: CharacterSuggestion[];
  locations: LocationSuggestion[];
}

interface PlotSuggestion {
  id: string;
  type: PlotPointType;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  subplot: string;
  relatedChapters: string[];
  consistencyIssues?: ConsistencyIssue[];
  relatedEntities?: CrossModuleEntities;
}

interface AIPlotSuggestionsProps {
  bookId: string;
  subplots: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggestionAccepted?: (suggestion: PlotSuggestion) => void;
  className?: string;
}

const PLOT_POINT_LABELS: Record<PlotPointType, string> = {
  'HOOK': 'Hook',
  'PLOT_TURN_1': 'Plot Turn 1',
  'PINCH_1': 'Pinch 1',
  'MIDPOINT': 'Midpoint',
  'PINCH_2': 'Pinch 2',
  'PLOT_TURN_2': 'Plot Turn 2',
  'RESOLUTION': 'Resolution'
};

const PLOT_POINT_DESCRIPTIONS: Record<PlotPointType, string> = {
  'HOOK': 'Hero in opposite state to their end state',
  'PLOT_TURN_1': 'Hero\'s world changes from status quo',
  'PINCH_1': 'Something goes wrong, forces hero into action',
  'MIDPOINT': 'Hero shifts from reaction to action',
  'PINCH_2': 'Something fails, seems hopeless',
  'PLOT_TURN_2': 'Hero gets final thing needed to resolve conflict',
  'RESOLUTION': 'Hero follows through, story concludes'
};

const AIPlotSuggestionsComponent = ({ bookId, subplots, isOpen, onOpenChange, onSuggestionAccepted, className }: AIPlotSuggestionsProps) => {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<PlotSuggestion[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<Set<string>>(new Set())
  const [selectedSubplot, setSelectedSubplot] = React.useState<string>('main')
  const [existingPlotPoints, setExistingPlotPoints] = React.useState<any[]>([])
  
  // Cross-module entity selection state
  const [selectedCharacters, setSelectedCharacters] = React.useState<Set<string>>(new Set())
  const [selectedLocations, setSelectedLocations] = React.useState<Set<string>>(new Set())

  // Use parent-controlled modal state
  const setIsOpen = React.useCallback((open: boolean) => {
    console.log('🚪 Modal state change:', open ? 'OPENING' : 'CLOSING')
    onOpenChange(open)
  }, [onOpenChange, isOpen])

  // Debug: Log when component mounts/unmounts (temporary)
  React.useEffect(() => {
    console.log('🏗️ AIPlotSuggestions MOUNTED')
    return () => {
      console.log('💥 AIPlotSuggestions UNMOUNTED - this should NOT happen during suggestion acceptance!')
    }
  }, [])

  const loadExistingPlotPoints = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/plot-points`)
      if (response.ok) {
        const plotPoints = await response.json()
        setExistingPlotPoints(plotPoints)
      }
    } catch (err) {
      console.error('Error loading existing plot points:', err)
    }
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    setSuggestions([])

    try {
      // Load existing plot points first
      await loadExistingPlotPoints()

      const response = await fetch(`/api/books/${bookId}/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'plot',
          options: {
            maxSuggestions: 5,
            generateEmbeddings: true, // Ensures embeddings exist for analysis
            subplot: selectedSubplot
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze plot structure')
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])

      if (data.suggestions?.length === 0) {
        setError('No plot suggestions were generated. All plot points for this subplot appear to be well-developed, or more content may be needed in your chapters.')
      }
    } catch (err) {
      console.error('Plot analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate plot suggestions')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAcceptSuggestion = async (suggestion: PlotSuggestion) => {
    console.log('🎯 Accepting suggestion:', suggestion.title)
    try {
      const existingPoint = getExistingPlotPoint(suggestion)

      let response;
      if (existingPoint) {
        // Update existing plot point
        response = await fetch(`/api/books/${bookId}/plot-points/${existingPoint.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: suggestion.title,
            description: suggestion.description,
            completed: false // Reset completion status since we're updating it
          })
        })
      } else {
        // Create new plot point
        response = await fetch(`/api/books/${bookId}/plot-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: suggestion.type,
            title: suggestion.title,
            description: suggestion.description,
            subplot: suggestion.subplot,
            orderIndex: getOrderIndexForType(suggestion.type),
            completed: false
          })
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 409) {
          // Handle duplicate plot point (conflict)
          setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]))
          alert(`${errorData.error || 'Plot point already exists.'} The suggestion has been marked as completed.`)
          onSuggestionAccepted?.(suggestion)
          return
        }
        
        throw new Error(errorData.error || 'Failed to create plot point')
      }

      // Apply consistency fixes if any exist
      if (suggestion.consistencyIssues && suggestion.consistencyIssues.length > 0) {
        const shouldApplyFixes = confirm(
          `This suggestion has ${suggestion.consistencyIssues.length} consistency issue(s). ` +
          `Would you like to apply the suggested fixes to maintain story consistency?`
        );

        if (shouldApplyFixes) {
          for (const issue of suggestion.consistencyIssues) {
            try {
              // Skip if essential properties are missing
              if (!issue.affectedPlotPoint?.id || !issue.suggestedFix) {
                console.warn('Skipping consistency fix due to missing data:', issue);
                continue;
              }

              const fixResponse = await fetch(`/api/books/${bookId}/plot-points/${issue.affectedPlotPoint.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: issue.suggestedFix?.newTitle || undefined,
                  description: issue.suggestedFix?.newDescription || undefined,
                })
              });

              if (!fixResponse.ok) {
                console.warn(`Failed to apply fix to plot point ${issue.affectedPlotPoint.id}`);
              }
            } catch (fixError) {
              console.warn('Failed to apply consistency fix:', fixError);
            }
          }
        }
      }

      // Create selected characters and locations
      if (suggestion.relatedEntities) {
        // Create selected characters
        if (suggestion.relatedEntities.characters && suggestion.relatedEntities.characters.length > 0) {
          for (const character of suggestion.relatedEntities.characters) {
            const characterKey = `${suggestion.id}-character-${character.name}`;
            if (selectedCharacters.has(characterKey)) {
              try {
                const characterResponse = await fetch(`/api/books/${bookId}/characters`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: character.name,
                    description: character.description,
                    role: character.role,
                    traits: character.traits,
                    backstory: character.backstory,
                  })
                });

                if (!characterResponse.ok) {
                  console.warn(`Failed to create character: ${character.name}`);
                }
              } catch (characterError) {
                console.warn('Failed to create character:', characterError);
              }
            }
          }
        }

        // Create selected locations
        if (suggestion.relatedEntities.locations && suggestion.relatedEntities.locations.length > 0) {
          for (const location of suggestion.relatedEntities.locations) {
            const locationKey = `${suggestion.id}-location-${location.name}`;
            if (selectedLocations.has(locationKey)) {
              try {
                const locationResponse = await fetch(`/api/books/${bookId}/locations`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: location.name,
                    description: location.description,
                    geography: location.geography,
                    culture: location.culture,
                  })
                });

                if (!locationResponse.ok) {
                  console.warn(`Failed to create location: ${location.name}`);
                }
              } catch (locationError) {
                console.warn('Failed to create location:', locationError);
              }
            }
          }
        }
      }

      // Mark as accepted
      setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]))
      
      // Notify parent component (silent refresh)
      console.log('📞 Notifying parent - silent refresh')
      onSuggestionAccepted?.(suggestion)
      
    } catch (err) {
      console.error('Error accepting suggestion:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept suggestion'
      alert(`Error: ${errorMessage}. Please try again.`)
    }
  }

  const handleRejectSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }

  const getOrderIndexForType = (type: PlotPointType): number => {
    const typeOrder = ['HOOK', 'PLOT_TURN_1', 'PINCH_1', 'MIDPOINT', 'PINCH_2', 'PLOT_TURN_2', 'RESOLUTION'];
    return typeOrder.indexOf(type);
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-50"
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-50"
    return "text-orange-600 bg-orange-50"
  }

  const getConsistencyIcon = (type: ConsistencyIssue['type']) => {
    switch (type) {
      case 'timeline': return Clock
      case 'character_state': return User
      case 'world_building': return Globe
      case 'logic': return Zap
      default: return AlertTriangle
    }
  }

  const getSeverityColor = (severity: ConsistencyIssue['severity']) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const hasConsistencyIssues = (suggestion: PlotSuggestion) => {
    return suggestion.consistencyIssues && suggestion.consistencyIssues.length > 0
  }

  const willReplacePlotPoint = (suggestion: PlotSuggestion) => {
    return existingPlotPoints.some(
      point => point.type === suggestion.type && point.subplot === suggestion.subplot
    )
  }

  const getExistingPlotPoint = (suggestion: PlotSuggestion) => {
    return existingPlotPoints.find(
      point => point.type === suggestion.type && point.subplot === suggestion.subplot
    )
  }

  const remainingSuggestions = suggestions.filter(s => !acceptedSuggestions.has(s.id))
  const allSuggestions = suggestions // Keep all suggestions for display

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)} onClick={() => {
          console.log('🔘 AI Plot Suggestions button clicked')
          setIsOpen(true)
        }}>
          <Sparkles className="h-4 w-4" />
          AI Plot Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            AI Plot Structure Suggestions
          </DialogTitle>
          <DialogDescription>
            Get AI-powered plot suggestions for your 7-point story structure
          </DialogDescription>
        </DialogHeader>

        {/* Subplot Selection */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <label className="text-sm font-medium">Analyze subplot:</label>
          <Select value={selectedSubplot} onValueChange={setSelectedSubplot}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subplots.map((subplot) => (
                <SelectItem key={subplot} value={subplot}>
                  {subplot === 'main' ? 'Main Plot' : subplot.charAt(0).toUpperCase() + subplot.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Analyze Plot Structure
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!isAnalyzing && suggestions.length === 0 && !error && (
            <Card className="text-center py-8">
              <CardContent>
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready to Analyze Plot Structure</h3>
                <p className="text-muted-foreground mb-4">
                  Select a subplot and click "Analyze Plot Structure" to get AI suggestions for your 7-point story structure
                </p>
              </CardContent>
            </Card>
          )}

          {isAnalyzing && (
            <Card className="text-center py-8">
              <CardContent>
                <Loader2 className="h-12 w-12 text-purple-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold mb-2">Analyzing Plot Structure</h3>
                <p className="text-muted-foreground">
                  AI is analyzing your book content for the {selectedSubplot === 'main' ? 'main plot' : `"${selectedSubplot}" subplot`}...
                </p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-destructive">Analysis Failed</h3>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {allSuggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Plot Suggestions for {selectedSubplot === 'main' ? 'Main Plot' : `"${selectedSubplot}" Subplot`}
                </h3>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {allSuggestions.length} total
                  </Badge>
                  {acceptedSuggestions.size > 0 && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      {acceptedSuggestions.size} accepted
                    </Badge>
                  )}
                </div>
              </div>

              {allSuggestions.map((suggestion) => (
                <Card key={suggestion.id} className={cn(
                  "border-l-4 border-l-purple-500",
                  acceptedSuggestions.has(suggestion.id) ? "opacity-60 pointer-events-none bg-green-50" : ""
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {PLOT_POINT_LABELS[suggestion.type]}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                          >
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                          {willReplacePlotPoint(suggestion) && (
                            <Badge variant="destructive" className="text-xs">
                              Will Replace
                            </Badge>
                          )}
                          {hasConsistencyIssues(suggestion) && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {suggestion.consistencyIssues!.length} Issue{suggestion.consistencyIssues!.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground mt-1">
                          {PLOT_POINT_DESCRIPTIONS[suggestion.type]}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {acceptedSuggestions.has(suggestion.id) ? (
                          <Button
                            size="sm"
                            disabled
                            className="gap-1 bg-green-600 text-white"
                          >
                            <Check className="h-3 w-3" />
                            Accepted
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAcceptSuggestion(suggestion)}
                            className="gap-1"
                          >
                            <Check className="h-3 w-3" />
                            {willReplacePlotPoint(suggestion) ? 'Replace' : 'Accept'}
                          </Button>
                        )}
                        {!acceptedSuggestions.has(suggestion.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectSuggestion(suggestion.id)}
                            className="gap-1"
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Plot Point Description</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {suggestion.description}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-1">AI Reasoning</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {suggestion.reasoning}
                        </p>
                      </div>

                      {hasConsistencyIssues(suggestion) && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-red-700 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            Consistency Issues ({suggestion.consistencyIssues!.length})
                          </h4>
                          <div className="space-y-2">
                            {suggestion.consistencyIssues!.map((issue, index) => {
                              const IconComponent = getConsistencyIcon(issue.type || 'UNKNOWN');
                              return (
                                <div 
                                  key={index} 
                                  className={cn("p-3 rounded border", getSeverityColor(issue.severity || 'low'))}
                                >
                                  <div className="flex items-start gap-2">
                                    <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-mono">
                                          {issue.severity?.toUpperCase() || 'UNKNOWN'}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {issue.type?.replace('_', ' ') || 'Unknown Type'}
                                        </Badge>
                                      </div>
                                      
                                      <div>
                                        <div className="font-medium text-xs mb-1">Issue:</div>
                                        <div className="text-xs">{issue.description || 'No description provided'}</div>
                                      </div>
                                      
                                      <div className="bg-white bg-opacity-50 p-2 rounded border text-xs">
                                        <div className="font-medium mb-1">
                                          Conflicts with: {issue.affectedPlotPoint?.subplot || 'Unknown'} → {issue.affectedPlotPoint?.type || 'Unknown'}
                                        </div>
                                        <div className="text-muted-foreground">
                                          "{issue.affectedPlotPoint?.title || 'Unknown plot point'}"
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <div className="font-medium text-xs mb-1">Suggested Fix:</div>
                                        <div className="text-xs">{issue.suggestedFix?.reasoning || 'No fix reasoning provided'}</div>
                                        {(issue.suggestedFix?.newTitle || issue.suggestedFix?.newDescription) && (
                                          <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs">
                                            {issue.suggestedFix?.newTitle && (
                                              <div><strong>New Title:</strong> {issue.suggestedFix.newTitle}</div>
                                            )}
                                            {issue.suggestedFix?.newDescription && (
                                              <div><strong>New Description:</strong> {issue.suggestedFix.newDescription}</div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {willReplacePlotPoint(suggestion) && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Current Plot Point (will be replaced)</h4>
                          <div className="bg-muted p-2 rounded text-xs">
                            <div className="font-medium">{getExistingPlotPoint(suggestion)?.title || 'Untitled'}</div>
                            <div className="text-muted-foreground mt-1">
                              {getExistingPlotPoint(suggestion)?.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      )}

                      {suggestion.relatedChapters.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Related Content</h4>
                          <div className="flex flex-wrap gap-1">
                            {suggestion.relatedChapters.slice(0, 3).map((chapter, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {chapter}
                              </Badge>
                            ))}
                            {suggestion.relatedChapters.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{suggestion.relatedChapters.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Cross-Module Entity Suggestions */}
                      {suggestion.relatedEntities && (suggestion.relatedEntities.characters.length > 0 || suggestion.relatedEntities.locations.length > 0) && (
                        <div className="border-t pt-3">
                          <h4 className="font-semibold text-sm mb-3 text-blue-700 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Also Create These Entities
                          </h4>
                          
                          {/* Character Suggestions */}
                          {suggestion.relatedEntities.characters.length > 0 && (
                            <div className="mb-3">
                              <h5 className="font-medium text-xs mb-2 text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                New Characters ({suggestion.relatedEntities.characters.length})
                              </h5>
                              <div className="space-y-2">
                                {suggestion.relatedEntities.characters.map((character, index) => {
                                  const characterKey = `${suggestion.id}-character-${character.name}`;
                                  const isSelected = selectedCharacters.has(characterKey);
                                  
                                  return (
                                    <div
                                      key={index}
                                      className={cn(
                                        "p-2 rounded border text-xs cursor-pointer transition-colors",
                                        isSelected ? "bg-blue-50 border-blue-200" : "bg-muted border-border hover:bg-muted/70"
                                      )}
                                      onClick={() => {
                                        if (acceptedSuggestions.has(suggestion.id)) return;
                                        
                                        setSelectedCharacters(prev => {
                                          const newSet = new Set(prev);
                                          if (isSelected) {
                                            newSet.delete(characterKey);
                                          } else {
                                            newSet.add(characterKey);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className={cn(
                                          "w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0",
                                          isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                        )}>
                                          {isSelected && <Check className="h-2 w-2 text-white" />}
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-blue-700">{character.name}</div>
                                          <div className="text-muted-foreground mt-0.5">{character.description}</div>
                                          {character.role && (
                                            <Badge variant="outline" className="mt-1 text-xs">
                                              {character.role}
                                            </Badge>
                                          )}
                                          <div className="text-xs text-blue-600 mt-1 italic">{character.reasoning}</div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Location Suggestions */}
                          {suggestion.relatedEntities.locations.length > 0 && (
                            <div>
                              <h5 className="font-medium text-xs mb-2 text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                New Locations ({suggestion.relatedEntities.locations.length})
                              </h5>
                              <div className="space-y-2">
                                {suggestion.relatedEntities.locations.map((location, index) => {
                                  const locationKey = `${suggestion.id}-location-${location.name}`;
                                  const isSelected = selectedLocations.has(locationKey);
                                  
                                  return (
                                    <div
                                      key={index}
                                      className={cn(
                                        "p-2 rounded border text-xs cursor-pointer transition-colors",
                                        isSelected ? "bg-green-50 border-green-200" : "bg-muted border-border hover:bg-muted/70"
                                      )}
                                      onClick={() => {
                                        if (acceptedSuggestions.has(suggestion.id)) return;
                                        
                                        setSelectedLocations(prev => {
                                          const newSet = new Set(prev);
                                          if (isSelected) {
                                            newSet.delete(locationKey);
                                          } else {
                                            newSet.add(locationKey);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className={cn(
                                          "w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0",
                                          isSelected ? "bg-green-600 border-green-600" : "border-gray-300"
                                        )}>
                                          {isSelected && <Check className="h-2 w-2 text-white" />}
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-green-700">{location.name}</div>
                                          <div className="text-muted-foreground mt-0.5">{location.description}</div>
                                          {location.geography && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Geography: {location.geography}
                                            </div>
                                          )}
                                          <div className="text-xs text-green-600 mt-1 italic">{location.reasoning}</div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {acceptedSuggestions.size > 0 && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-800">
                    {acceptedSuggestions.size} plot point{acceptedSuggestions.size > 1 ? 's' : ''} {acceptedSuggestions.size === 1 ? 'has' : 'have'} been {existingPlotPoints.some(p => acceptedSuggestions.has(p.id)) ? 'updated' : 'created'} successfully!
                  </span>
                </div>
                <div className="text-sm text-green-700 mt-1">
                  You can continue selecting more suggestions or close this dialog when finished.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const AIPlotSuggestions = AIPlotSuggestionsComponent
