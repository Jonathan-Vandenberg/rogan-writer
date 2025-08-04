"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { Brain, Loader2, CheckCircle, AlertCircle, BookOpen } from "lucide-react"
import { useState } from "react"

interface AnalysisResult {
  characters: number
  locations: number
  timelineEvents: number
  plotPoints: number
  sceneCards: number
  researchItems: number
}

interface AnalysisError {
  message: string
  details?: string
}

export function BookAnalysisButton() {
  const { selectedBookId } = useSelectedBook()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<AnalysisError | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const analyzeBook = async () => {
    if (!selectedBookId) return

    setIsAnalyzing(true)
    setCurrentStep("Fetching book content...")
    setError(null)
    setResult(null)

    try {
      // Step 1: Get book content
      const bookResponse = await fetch(`/api/books/${selectedBookId}`)
      if (!bookResponse.ok) {
        throw new Error('Failed to fetch book data')
      }
      const book = await bookResponse.json()
      
      if (!book.chapters || book.chapters.length === 0) {
        throw new Error('No chapters found in this book')
      }

      // Combine all chapter content
      const fullContent = book.chapters
        .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
        .map((chapter: any) => `${chapter.title}\n\n${chapter.content}`)
        .join('\n\n---\n\n')

      if (!fullContent.trim()) {
        throw new Error('Book appears to be empty')
      }

      setCurrentStep("Analyzing content with AI...")

      // Step 2: Analyze content
      const analysisResponse = await fetch(`/api/books/${selectedBookId}/analyze-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: fullContent })
      })

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const analysisData = await analysisResponse.json()
      
      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Analysis failed')
      }

      const analysis = analysisData.analysis

      // Step 3: Create entities
      let createdCounts = {
        characters: 0,
        locations: 0,
        timelineEvents: 0,
        plotPoints: 0,
        sceneCards: 0,
        researchItems: 0
      }

      // Create characters
      if (analysis.characters?.length > 0) {
        setCurrentStep(`Creating ${analysis.characters.length} characters...`)
        for (const character of analysis.characters) {
          try {
            await fetch(`/api/books/${selectedBookId}/characters`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(character)
            })
            createdCounts.characters++
          } catch (err) {
            console.warn('Failed to create character:', character.name, err)
          }
        }
      }

      // Create locations
      if (analysis.locations?.length > 0) {
        setCurrentStep(`Creating ${analysis.locations.length} locations...`)
        for (const location of analysis.locations) {
          try {
            await fetch(`/api/books/${selectedBookId}/locations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(location)
            })
            createdCounts.locations++
          } catch (err) {
            console.warn('Failed to create location:', location.name, err)
          }
        }
      }

      // Create plot points
      if (analysis.plotPoints?.length > 0) {
        setCurrentStep(`Creating ${analysis.plotPoints.length} plot points...`)
        for (let i = 0; i < analysis.plotPoints.length; i++) {
          try {
            const plotPoint = {
              ...analysis.plotPoints[i],
              orderIndex: i
            }
            await fetch(`/api/books/${selectedBookId}/plot-points`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(plotPoint)
            })
            createdCounts.plotPoints++
          } catch (err) {
            console.warn('Failed to create plot point:', analysis.plotPoints[i].title, err)
          }
        }
      }

      // Create timeline events
      if (analysis.timelineEvents?.length > 0) {
        setCurrentStep(`Creating ${analysis.timelineEvents.length} timeline events...`)
        
        // Get created characters and locations for linking
        const [charactersRes, locationsRes] = await Promise.all([
          fetch(`/api/books/${selectedBookId}/characters`),
          fetch(`/api/books/${selectedBookId}/locations`)
        ])
        
        const characters = charactersRes.ok ? await charactersRes.json() : []
        const locations = locationsRes.ok ? await locationsRes.json() : []
        
        const characterMap = new Map(characters.map((c: any) => [c.name, c.id]))
        const locationMap = new Map(locations.map((l: any) => [l.name, l.id]))

        for (const event of analysis.timelineEvents) {
          try {
            const eventData = {
              title: event.title,
              description: event.description,
              eventDate: event.eventDate,
              startTime: event.startTime,
              endTime: event.endTime,
              characterId: event.characterName ? characterMap.get(event.characterName) : undefined,
              locationId: event.locationName ? locationMap.get(event.locationName) : undefined
            }
            
            await fetch(`/api/books/${selectedBookId}/timeline-events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(eventData)
            })
            createdCounts.timelineEvents++
          } catch (err) {
            console.warn('Failed to create timeline event:', event.title, err)
          }
        }
      }

      // Create scene cards
      if (analysis.sceneCards?.length > 0) {
        setCurrentStep(`Creating ${analysis.sceneCards.length} scene cards...`)
        for (const scene of analysis.sceneCards) {
          try {
            await fetch(`/api/books/${selectedBookId}/scene-cards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scene)
            })
            createdCounts.sceneCards++
          } catch (err) {
            console.warn('Failed to create scene card:', scene.title, err)
          }
        }
      }

      // Create research items
      if (analysis.researchItems?.length > 0) {
        setCurrentStep(`Creating ${analysis.researchItems.length} research items...`)
        for (const item of analysis.researchItems) {
          try {
            await fetch(`/api/books/${selectedBookId}/research-items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
            createdCounts.researchItems++
          } catch (err) {
            console.warn('Failed to create research item:', item.title, err)
          }
        }
      }

      setCurrentStep("Complete!")
      setResult(createdCounts)

    } catch (err) {
      console.error('Analysis error:', err)
      setError({
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        details: err instanceof Error ? err.stack : undefined
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const resetState = () => {
    setResult(null)
    setError(null)
    setCurrentStep("")
    setShowDetails(false)
  }

  if (!selectedBookId) {
    return (
      <Button disabled variant="outline" className="gap-2">
        <BookOpen className="h-4 w-4" />
        Select a book first
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      <Button 
        onClick={analyzeBook}
        disabled={isAnalyzing}
        className="gap-2 w-full"
        variant={result ? "secondary" : "default"}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : result ? (
          <>
            <CheckCircle className="h-4 w-4" />
            Analysis Complete
          </>
        ) : error ? (
          <>
            <AlertCircle className="h-4 w-4" />
            Try Again
          </>
        ) : (
          <>
            <Brain className="h-4 w-4" />
            Analyze Book with AI
          </>
        )}
      </Button>

      {/* Progress indicator */}
      {isAnalyzing && currentStep && (
        <div className="text-sm text-muted-foreground text-center">
          {currentStep}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-300 font-medium">
            <CheckCircle className="h-4 w-4" />
            Analysis Successful!
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Characters: <span className="font-medium">{result.characters}</span></div>
            <div>Locations: <span className="font-medium">{result.locations}</span></div>
            <div>Timeline Events: <span className="font-medium">{result.timelineEvents}</span></div>
            <div>Plot Points: <span className="font-medium">{result.plotPoints}</span></div>
            <div>Scene Cards: <span className="font-medium">{result.sceneCards}</span></div>
            <div>Research Items: <span className="font-medium">{result.researchItems}</span></div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetState}
            className="w-full mt-2"
          >
            Run Again
          </Button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border bg-red-50 dark:bg-red-900/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium">
            <AlertCircle className="h-4 w-4" />
            Analysis Failed
          </div>
          <div className="text-sm text-red-700 dark:text-red-300">
            {error.message}
          </div>
          {error.details && (
            <details className="text-xs text-red-600 dark:text-red-400">
              <summary className="cursor-pointer">Show details</summary>
              <pre className="mt-1 whitespace-pre-wrap">{error.details}</pre>
            </details>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetState}
            className="w-full mt-2"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}