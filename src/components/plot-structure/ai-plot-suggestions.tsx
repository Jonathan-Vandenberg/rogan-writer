'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, Loader2, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlotSuggestion {
  id: string
  title: string
  description: string
  plotPoints: {
    hook: PlotPointDetail[]
    plotTurn1: PlotPointDetail[]
    pinch1: PlotPointDetail[]
    midpoint: PlotPointDetail[]
    pinch2: PlotPointDetail[]
    plotTurn2: PlotPointDetail[]
    resolution: PlotPointDetail[]
  }
  reasoning: string
  confidence: number
}

interface PlotPointDetail {
  title: string
  description: string
  orderIndex: number
}

interface AIPlotSuggestionsProps {
  bookId: string
  onPlotAccepted?: (suggestion: PlotSuggestion) => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  triggerButton?: React.ReactNode
}

const SECTION_LABELS = {
  hook: 'Hook',
  plotTurn1: 'Plot Turn 1',
  pinch1: 'Pinch 1',
  midpoint: 'Midpoint',
  pinch2: 'Pinch 2',
  plotTurn2: 'Plot Turn 2',
  resolution: 'Resolution'
} as const

export function AIPlotSuggestions({ 
  bookId, 
  onPlotAccepted, 
  isOpen: controlledIsOpen, 
  onOpenChange: controlledOnOpenChange,
  className, 
  triggerButton 
}: AIPlotSuggestionsProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false)
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalIsOpen
  const [suggestions, setSuggestions] = React.useState<PlotSuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = React.useState<Set<string>>(new Set())
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = React.useState<Record<string, Record<string, boolean>>>({})
  const [customDirection, setCustomDirection] = React.useState<string>('')
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const remainingSuggestions = suggestions.filter(s => !acceptedSuggestions.has(s.id))

  // Cache management
  const getCachedContext = async () => {
    console.log('🔍 Checking Redis cache for bookId:', bookId)
    try {
      const response = await fetch(`/api/books/${bookId}/book-planning-cache`)
      const data = await response.json()
      
      if (!data.cached) {
        console.log('❌ No cache entry found for this book')
        return null
      }
      
      const currentHash = await getBookContentHash(bookId)
      if (data.contentHash !== currentHash) {
        console.log('⚠️ Cache is stale (hash mismatch) - will fetch fresh data')
        return null
      }
      
      console.log('✓ Content hash matches!')
      console.log('📦 Retrieved cached context from Redis (age:', data.age, 'seconds)')
      return data.context
    } catch (error) {
      console.error('Error fetching Redis cache:', error)
      return null
    }
  }
  
  const setCachedContext = async (context: string) => {
    const contentHash = await getBookContentHash(bookId)
    try {
      await fetch(`/api/books/${bookId}/book-planning-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, contentHash })
      })
      console.log('💾 Cached context in Redis (hash:', contentHash.substring(0, 8) + ')')
    } catch (error) {
      console.error('Error caching to Redis:', error)
    }
  }

  const getBookContentHash = async (bookId: string): Promise<string> => {
    const response = await fetch(`/api/books/${bookId}/content-hash`)
    const data = await response.json()
    return data.hash
  }

  const handleAnalyze = async (isAnalyzeMore = false) => {
    setIsAnalyzing(true)
    setError(null)
    
    if (!isAnalyzeMore) {
      setSuggestions([])
    }

    try {
      const existingSuggestions = suggestions.map(s => ({
        title: s.title,
        description: s.description
      }))

      const cachedContext = await getCachedContext()
      const willUseCache = cachedContext !== null
      
      if (willUseCache) {
        console.log('✅ USING CACHED CONTEXT - Skipping database fetch!')
      } else {
        console.log('❌ NO CACHE - Will fetch fresh planning data')
      }

      console.log('🚀 Sending plot structure request...');
      
      const response = await fetch(`/api/books/${bookId}/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'plot',
          options: {
            maxSuggestions: 3,
            generateStructures: true, // Generate complete plot structures
            existingSuggestions: isAnalyzeMore ? existingSuggestions : [],
            cachedContext: cachedContext,
            skipVectorSearch: willUseCache,
            customDirection: customDirection.trim() || undefined // Pass custom direction if provided
          }
        })
      })

      console.log('📥 Response received:', response.status);

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      console.log('✅ Data parsed:', data);
      
      console.log('📥 Received response:', {
        isAnalyzeMore,
        hasContext: !!data.context,
        contextLength: data.context?.length,
        suggestionsCount: data.suggestions?.length,
        usedCache: data.metadata?.usedCache
      })
      
      // Always save context if it's returned (either fresh or updated)
      if (data.context && !data.metadata?.usedCache) {
        console.log('💾 Saving fresh planning context to Redis...')
        await setCachedContext(data.context)
        console.log('✅ Context saved to Redis successfully')
      } else if (data.metadata?.usedCache) {
        console.log('⚡ Used cached context - saved time & money!')
      }
      
      if (isAnalyzeMore) {
        setSuggestions(prev => [...prev, ...(data.suggestions || [])])
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
          ? 'No additional plot suggestions could be generated.'
          : 'No plot suggestions were generated. Try adding more content to your book.')
      }
    } catch (error) {
      console.error('AI analysis error:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze book content')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleSelection = (suggestionId: string) => {
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

  const handleConfirmSelected = async () => {
    for (const suggestionId of selectedSuggestions) {
      const suggestion = suggestions.find(s => s.id === suggestionId)
      if (suggestion) {
        await handleAcceptPlot(suggestion)
      }
    }
    setSelectedSuggestions(new Set())
  }

  const handleAcceptPlot = async (suggestion: PlotSuggestion) => {
    try {
      // Create a clean subplot name based on the suggestion title (no dashes)
      const subplotName = suggestion.title
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
        .substring(0, 50)
      
      console.log('✨ Creating new subplot:', subplotName);

      // Create all plot points for this suggestion - ONE point per type only
      const allPlotPoints: any[] = []
      
      // Add HOOK
      if (suggestion.plotPoints.hook.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.hook[0], 
          type: 'HOOK', 
          subplot: subplotName 
        })
      }
      
      // Add PLOT_TURN_1
      if (suggestion.plotPoints.plotTurn1.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.plotTurn1[0], 
          type: 'PLOT_TURN_1', 
          subplot: subplotName 
        })
      }
      
      // Add PINCH_1
      if (suggestion.plotPoints.pinch1.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.pinch1[0], 
          type: 'PINCH_1', 
          subplot: subplotName 
        })
      }
      
      // Add MIDPOINT
      if (suggestion.plotPoints.midpoint.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.midpoint[0], 
          type: 'MIDPOINT', 
          subplot: subplotName 
        })
      }
      
      // Add PINCH_2
      if (suggestion.plotPoints.pinch2.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.pinch2[0], 
          type: 'PINCH_2', 
          subplot: subplotName 
        })
      }
      
      // Add PLOT_TURN_2
      if (suggestion.plotPoints.plotTurn2.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.plotTurn2[0], 
          type: 'PLOT_TURN_2', 
          subplot: subplotName 
        })
      }
      
      // Add RESOLUTION
      if (suggestion.plotPoints.resolution.length > 0) {
        allPlotPoints.push({ 
          ...suggestion.plotPoints.resolution[0], 
          type: 'RESOLUTION', 
          subplot: subplotName 
        })
      }

      // Create new plot points
      console.log('✨ Creating', allPlotPoints.length, 'new plot points...');
      for (const point of allPlotPoints) {
        const response = await fetch(`/api/books/${bookId}/plot-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: point.title,
            description: point.description,
            type: point.type,
            subplot: point.subplot,
            orderIndex: point.orderIndex
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Failed to create plot point:', errorData)
          throw new Error(`Failed to create plot point: ${errorData.error || 'Unknown error'}`)
        }
      }

      console.log('✅ Successfully created all plot points as new subplot:', subplotName);
      setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]))
      onPlotAccepted?.(suggestion)
    } catch (error) {
      console.error('Error accepting plot suggestion:', error)
      alert(`Failed to accept plot suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRejectSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }

  const toggleSection = (suggestionId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [suggestionId]: {
        ...prev[suggestionId],
        [section]: !prev[suggestionId]?.[section]
      }
    }))
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-50"
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-50"
    return "text-orange-600 bg-orange-50"
  }

  return (
    <>
      {triggerButton && (
        <div onClick={() => setIsOpen(true)}>
          {triggerButton}
        </div>
      )}
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
        className="!max-w-none max-h-[90vh] flex flex-col"
        style={{ width: '70vw', maxWidth: 'none' }}
      >
        <DialogHeader>
          <DialogTitle>AI-Generated Plot Structures</DialogTitle>
          <DialogDescription>
            AI will analyze your book's planning data. Optionally add custom direction to guide the suggestions.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
          {suggestions.length === 0 && !isAnalyzing && !error && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Generate Plot Structures</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Let AI analyze your book and suggest 3 complete plot structures
                </p>
                
                {/* Custom Direction Textarea */}
                <div className="w-full max-w-2xl mb-4">
                  <Label htmlFor="custom-direction" className="text-left block mb-2">
                    Custom Direction (Optional)
                  </Label>
                  <Textarea
                    id="custom-direction"
                    value={customDirection}
                    onChange={(e) => setCustomDirection(e.target.value)}
                    placeholder="e.g., Focus on a mystery subplot involving a stolen artifact, or emphasize character-driven emotional arcs..."
                    className="min-h-[100px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-left">
                    Provide specific guidance for the AI to shape plot suggestions toward your vision
                  </p>
                </div>

                <Button onClick={() => handleAnalyze(false)} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {customDirection.trim() ? 'Generate with Custom Direction' : 'Analyze Book'}
                </Button>
              </CardContent>
            </Card>
          )}

          {isAnalyzing && suggestions.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Analyzing your book and generating plot structures...</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-6">
                <p className="text-sm text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {remainingSuggestions.map((suggestion) => (
            <Card key={suggestion.id} className="border-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      id={`plot-${suggestion.id}`}
                      checked={selectedSuggestions.has(suggestion.id)}
                      onCheckedChange={() => toggleSelection(suggestion.id)}
                      disabled={acceptedSuggestions.has(suggestion.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <label 
                        htmlFor={`plot-${suggestion.id}`}
                        className="font-semibold text-lg cursor-pointer"
                      >
                        {suggestion.title}
                      </label>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs", getConfidenceColor(suggestion.confidence))}>
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </Badge>
                        {acceptedSuggestions.has(suggestion.id) && (
                          <Badge className="text-xs bg-green-100 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> Accepted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(suggestion.plotPoints).map(([sectionKey, points]) => {
                  const section = sectionKey as keyof typeof SECTION_LABELS
                  const isExpanded = expandedSections[suggestion.id]?.[section]
                  
                  // Show all points since each section now maps 1:1 to a PlotPointType
                  const pointsToShow = points.slice(0, 1) // Always max 1 point per section
                  
                  const hasPoints = pointsToShow.length > 0
                  if (!hasPoints) return null // Don't show empty sections
                  
                  return (
                    <div key={section} className="border rounded-lg">
                      <button
                        onClick={() => toggleSection(suggestion.id, section)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{SECTION_LABELS[section]}</span>
                          <Badge variant="secondary" className="text-xs">
                            {pointsToShow.length} {pointsToShow.length === 1 ? 'point' : 'points'}
                          </Badge>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2">
                          {pointsToShow.map((point, idx) => (
                            <div key={idx} className="bg-muted/30 rounded p-3">
                              <div className="font-medium text-sm mb-1">{point.title}</div>
                              <p className="text-xs text-muted-foreground">{point.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="pt-2 border-t mt-4">
                  <h4 className="font-medium text-sm mb-2">Why This Structure:</h4>
                  <p className="text-xs text-muted-foreground italic">{suggestion.reasoning}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {suggestions.length > 0 && remainingSuggestions.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t gap-4">
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
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {selectedSuggestions.size} selected • {remainingSuggestions.length} total
              </div>
              <Button
                onClick={handleConfirmSelected}
                disabled={selectedSuggestions.size === 0}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Confirm Selected ({selectedSuggestions.size})
              </Button>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  )
}
