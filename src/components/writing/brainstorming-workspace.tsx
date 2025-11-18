"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Maximize2 } from "lucide-react"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { cn } from "@/lib/utils"

interface BrainstormingWorkspaceProps {
  className?: string
}

export function BrainstormingWorkspace({ className }: BrainstormingWorkspaceProps) {
  const router = useRouter()
  const { selectedBookId } = useSelectedBook()

  if (!selectedBookId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm">Brainstorming Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a book to start brainstorming
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm h-full flex items-center">Brainstorming Workspace</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => router.push("/brainstorming")}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}

