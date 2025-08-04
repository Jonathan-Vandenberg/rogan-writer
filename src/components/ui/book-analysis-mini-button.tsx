"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { Brain, Loader2 } from "lucide-react"
import { useState } from "react"

interface BookAnalysisMiniButtonProps {
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg"
}

export function BookAnalysisMiniButton({ 
  onSuccess, 
  onError, 
  variant = "outline",
  size = "sm" 
}: BookAnalysisMiniButtonProps) {
  const { selectedBookId } = useSelectedBook()
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeBook = async () => {
    if (!selectedBookId) {
      onError?.("No book selected")
      return
    }

    setIsAnalyzing(true)

    try {
      // Get book content
      const bookResponse = await fetch(`/api/books/${selectedBookId}`)
      if (!bookResponse.ok) throw new Error('Failed to fetch book data')
      const book = await bookResponse.json()
      
      if (!book.chapters?.length) throw new Error('No chapters found')

      // Combine content
      const fullContent = book.chapters
        .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
        .map((chapter: any) => `${chapter.title}\n\n${chapter.content}`)
        .join('\n\n---\n\n')

      if (!fullContent.trim()) throw new Error('Book is empty')

      // Analyze
      const analysisResponse = await fetch(`/api/books/${selectedBookId}/analyze-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullContent })
      })

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const result = await analysisResponse.json()
      onSuccess?.(result)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      onError?.(errorMessage)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <Button 
      onClick={analyzeBook}
      disabled={isAnalyzing || !selectedBookId}
      variant={variant}
      size={size}
      className="gap-2"
    >
      {isAnalyzing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Brain className="h-4 w-4" />
      )}
      {isAnalyzing ? "Analyzing..." : "AI Analyze"}
    </Button>
  )
}