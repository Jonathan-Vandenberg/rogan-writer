"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Check, X, Loader2, Target, AlertCircle, Clock, User, Globe, Zap, BookOpen, Calendar, Film } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Plot point types for orderIndex calculation
const PLOT_POINT_TYPES: { type: string; label: string }[] = [
  { type: 'HOOK', label: 'Hook' },
  { type: 'PLOT_TURN_1', label: 'Plot Turn 1' },
  { type: 'PINCH_1', label: 'Pinch 1' },
  { type: 'MIDPOINT', label: 'Midpoint' },
  { type: 'PINCH_2', label: 'Pinch 2' },
  { type: 'PLOT_TURN_2', label: 'Plot Turn 2' },
  { type: 'RESOLUTION', label: 'Resolution' },
]

// Define interfaces based on the AI analysis service
interface TimelineEventSuggestion {
  id: string;
  title: string;
  description: string;
  eventDate?: string;
  eventType: 'historical' | 'personal' | 'world_event' | 'plot_event';
  impact: string;
  reasoning: string;
  confidence: number;
  relatedCharacters: string[];
  relatedLocations: string[];
  relatedChapters: string[];
}

interface CharacterSuggestion {
  id: string;
  name: string;
  description: string;
  role: string;
  traits?: string[];
  backstory?: string;
  reasoning: string;
  confidence: number;
  relatedChapters: string[];
}

interface LocationSuggestion {
  id: string;
  name: string;
  description: string;
  geography?: string;
  culture?: string;
  reasoning: string;
  confidence: number;
  relatedChapters: string[];
}

interface PlotSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  subplot: string;
  relatedChapters: string[];
}

interface SceneCardSuggestion {
  id: string;
  title: string;
  description: string;
  purpose: string;
  conflict: string;
  outcome: string;
  pov?: string;
  setting?: string;
  reasoning: string;
  confidence: number;
  relatedChapters: string[];
}

interface BrainstormingSuggestion {
  id: string;
  title: string;
  content: string;
  reasoning: string;
  tags: string[];
  confidence: number;
  relatedChapters: string[];
}

interface ComprehensiveAnalysisResult {
  timeline: TimelineEventSuggestion[];
  characters: CharacterSuggestion[];
  locations: LocationSuggestion[];
  plotPoints: PlotSuggestion[];
  sceneCards: SceneCardSuggestion[];
  brainstorming: BrainstormingSuggestion[];
}

interface ComprehensiveAnalysisProps {
  bookId: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ComprehensiveAnalysis = ({ bookId, className, open: controlledOpen, onOpenChange }: ComprehensiveAnalysisProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [analysisResult, setAnalysisResult] = React.useState<ComprehensiveAnalysisResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = React.useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = React.useState(false)
  
  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)
    
    try {
      const response = await fetch(`/api/books/${bookId}/analyze-comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }
      
      const data = await response.json()
      
      // Ensure all fields are arrays (handle cases where agents return objects)
      const result = data.analysisResult || {}
      const normalizedResult: ComprehensiveAnalysisResult = {
        timeline: Array.isArray(result.timeline) ? result.timeline : (result.timeline?.suggestions || []),
        characters: Array.isArray(result.characters) ? result.characters : (result.characters?.suggestions || []),
        locations: Array.isArray(result.locations) ? result.locations : (result.locations?.suggestions || []),
        plotPoints: Array.isArray(result.plotPoints) ? result.plotPoints : (result.plotPoints?.suggestions || []),
        sceneCards: Array.isArray(result.sceneCards) ? result.sceneCards : (result.sceneCards?.suggestions || []),
        brainstorming: Array.isArray(result.brainstorming) ? result.brainstorming : (result.brainstorming?.suggestions || [])
      }
      
      setAnalysisResult(normalizedResult)
      
      // Start with no suggestions selected - user must manually choose
      setSelectedSuggestions(new Set<string>())
      
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCreateSelected = async () => {
    if (!analysisResult || selectedSuggestions.size === 0) return
    
    setIsCreating(true)
    let successCount = 0
    let errorCount = 0
    
    try {
      // Create timeline events
      for (const suggestion of analysisResult.timeline) {
        if (selectedSuggestions.has(suggestion.id)) {
          try {
            const response = await fetch(`/api/books/${bookId}/timeline-events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: suggestion.title,
                description: suggestion.description,
                eventDate: suggestion.eventDate,
              })
            })
            if (response.ok) {
              successCount++
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error(`Failed to create timeline event:`, errorData)
              errorCount++
            }
          } catch (err) {
            console.error(`Error creating timeline event:`, err)
            errorCount++
          }
        }
      }

      // Create characters
      for (const suggestion of analysisResult.characters) {
        if (selectedSuggestions.has(suggestion.id)) {
          try {
            const response = await fetch(`/api/books/${bookId}/characters`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: suggestion.name,
                description: suggestion.description,
                role: suggestion.role,
                traits: suggestion.traits,
                backstory: suggestion.backstory,
              })
            })
            if (response.ok) {
              successCount++
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error(`Failed to create character:`, errorData)
              errorCount++
            }
          } catch (err) {
            console.error(`Error creating character:`, err)
            errorCount++
          }
        }
      }

      // Create locations
      for (const suggestion of analysisResult.locations) {
        if (selectedSuggestions.has(suggestion.id)) {
          try {
            const response = await fetch(`/api/books/${bookId}/locations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: suggestion.name,
                description: suggestion.description,
                geography: suggestion.geography,
                culture: suggestion.culture,
              })
            })
            if (response.ok) {
              successCount++
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error(`Failed to create location:`, errorData)
              errorCount++
            }
          } catch (err) {
            console.error(`Error creating location:`, err)
            errorCount++
          }
        }
      }

      // Create scene cards
      for (const suggestion of analysisResult.sceneCards) {
        if (selectedSuggestions.has(suggestion.id)) {
          try {
            const response = await fetch(`/api/books/${bookId}/scene-cards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: suggestion.title,
                description: suggestion.description,
                purpose: suggestion.purpose,
                conflict: suggestion.conflict,
                outcome: suggestion.outcome,
              })
            })
            if (response.ok) {
              successCount++
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error(`Failed to create scene card:`, errorData)
              errorCount++
            }
          } catch (err) {
            console.error(`Error creating scene card:`, err)
            errorCount++
          }
        }
      }

      // Create brainstorming notes
      for (const suggestion of analysisResult.brainstorming) {
        if (selectedSuggestions.has(suggestion.id)) {
          try {
            const response = await fetch(`/api/books/${bookId}/brainstorming`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: suggestion.title,
                content: suggestion.content,
                tags: suggestion.tags,
              })
            })
            if (response.ok) {
              successCount++
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error(`Failed to create brainstorming note:`, errorData)
              errorCount++
            }
          } catch (err) {
            console.error(`Error creating brainstorming note:`, err)
            errorCount++
          }
        }
      }

      // Create plot points
      for (const suggestion of analysisResult.plotPoints) {
        if (selectedSuggestions.has(suggestion.id)) {
          try {
            // Normalize subplot: empty string, undefined, or 'main' should become null for main plot
            // But preserve actual subplot names
            let subplotValue: string | null = null
            if (suggestion.subplot && suggestion.subplot.trim() !== '' && suggestion.subplot.toLowerCase() !== 'main') {
              subplotValue = suggestion.subplot.trim()
            }
            
            console.log(`Creating plot point: ${suggestion.type}, subplot: "${subplotValue || 'main (null)'}", title: ${suggestion.title}`)
            
            const response = await fetch(`/api/books/${bookId}/plot-points`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: suggestion.type,
                title: suggestion.title,
                description: suggestion.description,
                subplot: subplotValue,
                orderIndex: PLOT_POINT_TYPES.findIndex(p => p.type === suggestion.type) + 1
              })
            })
            // Both 200 (existing) and 201 (created) are success
            if (response.ok) {
              successCount++
              const createdPoint = await response.json().catch(() => null)
              // Log if it was an existing plot point (200) vs newly created (201)
              if (response.status === 200) {
                console.log(`Plot point ${suggestion.type} already exists for subplot ${subplotValue || 'main'}, using existing`)
              } else {
                console.log(`✅ Created plot point ${suggestion.type} for subplot "${createdPoint?.subplot || 'main'}"`)
              }
            } else {
              const errorData = await response.json().catch(() => ({}))
              // Skip duplicate plot points (they already exist) - should not happen now, but keep as fallback
              if (response.status === 409) {
                console.log(`Plot point ${suggestion.type} already exists for subplot ${suggestion.subplot || 'main'}, skipping`)
                successCount++ // Count as success since it exists
              } else {
                errorCount++
                console.error(`Failed to create plot point:`, errorData)
              }
            }
          } catch (err) {
            console.error(`Error creating plot point:`, err)
            errorCount++
          }
        }
      }

      // Show results with toast
      if (successCount > 0) {
        toast.success(
          `Successfully created ${successCount} item${successCount !== 1 ? 's' : ''}!`,
          {
            description: errorCount > 0 ? `${errorCount} item${errorCount !== 1 ? 's' : ''} failed or were skipped` : undefined
          }
        )
        
        // Dispatch custom event to refresh plot page if plot points were created
        const plotPointsCreated = analysisResult.plotPoints.some(s => selectedSuggestions.has(s.id))
        if (plotPointsCreated) {
          console.log('📢 Dispatching plot-points-updated event to refresh plot page')
          window.dispatchEvent(new CustomEvent('plot-points-updated'))
          
          // Also log what subplots were created
          const createdSubplots = analysisResult.plotPoints
            .filter(s => selectedSuggestions.has(s.id))
            .map(s => {
              const subplot = s.subplot && s.subplot.trim() !== '' && s.subplot.toLowerCase() !== 'main' 
                ? s.subplot.trim() 
                : 'main'
              return subplot
            })
          const uniqueSubplots = [...new Set(createdSubplots)]
          console.log(`📋 Created plot points for subplots:`, uniqueSubplots)
        }
        
        setIsOpen(false) // Close modal on success
      } else {
        toast.error('No items were created', {
          description: errorCount > 0 ? 'Please check for errors in the console' : 'No items were selected'
        })
      }
      
    } catch (err) {
      console.error('Creation error:', err)
      toast.error('Failed to create selected items', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const toggleSuggestion = (suggestionId: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId)
      } else {
        newSet.add(suggestionId)
      }
      return newSet
    })
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400"
    if (confidence >= 0.6) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'historical': return Clock
      case 'personal': return User
      case 'world_event': return Globe
      case 'plot_event': return Zap
      default: return Calendar
    }
  }

  const totalSuggestions = analysisResult ? 
    analysisResult.timeline.length + 
    analysisResult.characters.length + 
    analysisResult.locations.length + 
    analysisResult.plotPoints.length + 
    analysisResult.sceneCards.length + 
    analysisResult.brainstorming.length : 0

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button className={cn("gap-2", className)}>
            <Sparkles className="h-4 w-4" />
            Analyze Entire Book
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="!max-w-none w-[96vw] h-[94vh] !p-4 overflow-hidden flex flex-col" style={{ width: '96vw', height: '94vh', maxWidth: 'none' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Comprehensive Book Analysis
          </DialogTitle>
          <DialogDescription>
            AI will analyze your entire book and suggest updates for all planning modules
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!analysisResult ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
                  <p className="text-sm text-muted-foreground">Analyzing your book content...</p>
                  <p className="text-xs text-muted-foreground">This may take a while...</p>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  <Button onClick={handleAnalyze} variant="outline">
                    Try Again
                  </Button>
                </>
              ) : (
                <>
                  <Target className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  <p className="text-sm text-muted-foreground">Ready to analyze your book</p>
                  <Button onClick={handleAnalyze} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Start Analysis
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Summary */}
              <div className="mb-4 p-4 bg-muted/50 dark:bg-muted/20 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Analysis Complete</h3>
                    <p className="text-sm text-muted-foreground">
                      Found {totalSuggestions} suggestions across all modules
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCreateSelected} 
                      disabled={selectedSuggestions.size === 0 || isCreating}
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
                          Create Selected ({selectedSuggestions.size})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabs for different modules */}
              <Tabs defaultValue="timeline" className="flex-1 overflow-hidden">
                <TabsList className="grid w-full grid-cols-6 h-12 text-sm">
                  <TabsTrigger value="timeline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    Timeline ({analysisResult.timeline.length})
                  </TabsTrigger>
                  <TabsTrigger value="characters" className="gap-1">
                    <User className="h-3 w-3" />
                    Characters ({analysisResult.characters.length})
                  </TabsTrigger>
                  <TabsTrigger value="locations" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Locations ({analysisResult.locations.length})
                  </TabsTrigger>
                  <TabsTrigger value="plots" className="gap-1">
                    <Target className="h-3 w-3" />
                    Plots ({analysisResult.plotPoints.length})
                  </TabsTrigger>
                  <TabsTrigger value="scenes" className="gap-1">
                    <Film className="h-3 w-3" />
                    Scenes ({analysisResult.sceneCards.length})
                  </TabsTrigger>
                  <TabsTrigger value="brainstorm" className="gap-1">
                    <BookOpen className="h-3 w-3" />
                    Ideas ({analysisResult.brainstorming.length})
                  </TabsTrigger>
                </TabsList>

                <div className="mt-4 overflow-y-auto flex-1">
                  {/* Timeline Events Tab */}
                  <TabsContent value="timeline" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {analysisResult.timeline.map((suggestion) => {
                      const isSelected = selectedSuggestions.has(suggestion.id)
                      const IconComponent = getEventTypeIcon(suggestion.eventType)
                      
                      return (
                        <Card 
                          key={suggestion.id}
                          className={cn(
                            "border-l-4 border-l-blue-500 cursor-pointer transition-colors",
                            isSelected ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center",
                                  isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                )}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <IconComponent className="h-4 w-4 text-blue-600" />
                                <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                              >
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.description}
                            </p>
                            <div className="text-xs text-blue-600 italic mb-2">
                              {suggestion.reasoning}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {suggestion.eventType}
                              </Badge>
                              {suggestion.eventDate && (
                                <Badge variant="outline" className="text-xs">
                                  {suggestion.eventDate}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                    {analysisResult.timeline.length === 0 && (
                      <div className="col-span-full">
                        <p className="text-center text-muted-foreground py-8">
                          No timeline event suggestions found
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Characters Tab */}
                  <TabsContent value="characters" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {analysisResult.characters.map((suggestion) => {
                      const isSelected = selectedSuggestions.has(suggestion.id)
                      
                      return (
                        <Card 
                          key={suggestion.id}
                          className={cn(
                            "border-l-4 border-l-green-500 cursor-pointer transition-colors",
                            isSelected ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center",
                                  isSelected ? "bg-green-600 border-green-600" : "border-gray-300"
                                )}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <User className="h-4 w-4 text-green-600" />
                                <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                              >
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.description}
                            </p>
                            <div className="text-xs text-green-600 italic mb-2">
                              {suggestion.reasoning}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {suggestion.role}
                              </Badge>
                              {suggestion.traits?.map((trait, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                    {analysisResult.characters.length === 0 && (
                      <div className="col-span-full">
                        <p className="text-center text-muted-foreground py-8">
                          No character suggestions found
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Similar patterns for other tabs... */}
                  <TabsContent value="locations" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {analysisResult.locations.map((suggestion) => {
                      const isSelected = selectedSuggestions.has(suggestion.id)
                      
                      return (
                        <Card 
                          key={suggestion.id}
                          className={cn(
                            "border-l-4 border-l-orange-500 cursor-pointer transition-colors",
                            isSelected ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center",
                                  isSelected ? "bg-orange-600 border-orange-600" : "border-gray-300"
                                )}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <Globe className="h-4 w-4 text-orange-600" />
                                <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                              >
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.description}
                            </p>
                            <div className="text-xs text-orange-600 italic mb-2">
                              {suggestion.reasoning}
                            </div>
                            {(suggestion.geography || suggestion.culture) && (
                              <div className="space-y-1">
                                {suggestion.geography && (
                                  <div className="text-xs">
                                    <span className="font-medium">Geography:</span> {suggestion.geography}
                                  </div>
                                )}
                                {suggestion.culture && (
                                  <div className="text-xs">
                                    <span className="font-medium">Culture:</span> {suggestion.culture}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                    {analysisResult.locations.length === 0 && (
                      <div className="col-span-full">
                        <p className="text-center text-muted-foreground py-8">
                          No location suggestions found
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Plot Points Tab */}
                  <TabsContent value="plots" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {analysisResult.plotPoints.map((suggestion) => {
                      const isSelected = selectedSuggestions.has(suggestion.id)
                      
                      return (
                        <Card 
                          key={suggestion.id}
                          className={cn(
                            "border-l-4 border-l-red-500 cursor-pointer transition-colors",
                            isSelected ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-sm font-semibold line-clamp-2">
                                  {suggestion.title}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {suggestion.type}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {suggestion.subplot}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <Badge variant="secondary" className={cn("text-xs", getConfidenceColor(suggestion.confidence))}>
                                  {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                                {isSelected && <Check className="h-4 w-4 text-green-600" />}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                              {suggestion.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Why:</span> {suggestion.reasoning}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                    {analysisResult.plotPoints.length === 0 && (
                      <div className="col-span-full">
                        <p className="text-center text-muted-foreground py-8">
                          No plot point suggestions found
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Scene Cards Tab */}
                  <TabsContent value="scenes" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {analysisResult.sceneCards.map((suggestion) => {
                      const isSelected = selectedSuggestions.has(suggestion.id)
                      
                      return (
                        <Card 
                          key={suggestion.id}
                          className={cn(
                            "border-l-4 border-l-purple-500 cursor-pointer transition-colors",
                            isSelected ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center",
                                  isSelected ? "bg-purple-600 border-purple-600" : "border-gray-300"
                                )}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <Film className="h-4 w-4 text-purple-600" />
                                <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                              >
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.description}
                            </p>
                            <div className="text-xs text-purple-600 italic mb-2">
                              {suggestion.reasoning}
                            </div>
                            <div className="space-y-1 text-xs">
                              {suggestion.purpose && (
                                <div><span className="font-medium">Purpose:</span> {suggestion.purpose}</div>
                              )}
                              {suggestion.conflict && (
                                <div><span className="font-medium">Conflict:</span> {suggestion.conflict}</div>
                              )}
                              {suggestion.outcome && (
                                <div><span className="font-medium">Outcome:</span> {suggestion.outcome}</div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                    {analysisResult.sceneCards.length === 0 && (
                      <div className="col-span-full">
                        <p className="text-center text-muted-foreground py-8">
                          No scene card suggestions found
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Brainstorming Tab */}
                  <TabsContent value="brainstorm" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {analysisResult.brainstorming.map((suggestion) => {
                      const isSelected = selectedSuggestions.has(suggestion.id)
                      
                      return (
                        <Card 
                          key={suggestion.id}
                          className={cn(
                            "border-l-4 border-l-yellow-500 cursor-pointer transition-colors",
                            isSelected ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-sm font-semibold line-clamp-2">
                                  {suggestion.title}
                                </CardTitle>
                                {suggestion.tags && suggestion.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {suggestion.tags.slice(0, 3).map((tag, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <Badge variant="secondary" className={cn("text-xs", getConfidenceColor(suggestion.confidence))}>
                                  {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                                {isSelected && <Check className="h-4 w-4 text-green-600" />}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-xs text-muted-foreground line-clamp-4 mb-2">
                              {suggestion.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Why:</span> {suggestion.reasoning}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                    {analysisResult.brainstorming.length === 0 && (
                      <div className="col-span-full">
                        <p className="text-center text-muted-foreground py-8">
                          No brainstorming suggestions found
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ComprehensiveAnalysis
