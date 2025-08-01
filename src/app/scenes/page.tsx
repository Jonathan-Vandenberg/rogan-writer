"use client"

import { useSelectedBook } from '@/contexts/selected-book-context'
import { SceneCardBoard } from '@/components/scene-cards'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'

export default function ScenesPage() {
  const { selectedBookId } = useSelectedBook()

  if (!selectedBookId) {
    return (
      <div className="container mx-auto p-6">
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Book Selected</h3>
            <p className="text-muted-foreground">
              Please select a book to manage your scene cards.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <SceneCardBoard bookId={selectedBookId} />
    </div>
  )
} 