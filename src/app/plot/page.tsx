"use client"

import { useSelectedBook } from '@/contexts/selected-book-context'
import { PlotStructureMatrix } from '@/components/plot-structure'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'

export default function PlotStructurePage() {
  const { selectedBookId } = useSelectedBook()

  if (!selectedBookId) {
    return (
      <div className="container mx-auto p-6">
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Book Selected</h3>
            <p className="text-muted-foreground">
              Please select a book to work on your plot structure.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <PlotStructureMatrix bookId={selectedBookId} />
    </div>
  )
} 