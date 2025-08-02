"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  ChevronLeft, 
  ChevronRight, 
  SkipBack, 
  SkipForward,
  Book,
  FileText,
  Plus,
  Edit3
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PageNavigationProps {
  currentPage: number
  totalPages: number
  currentChapter: number
  totalChapters: number
  chapterTitle?: string
  onPageChange: (page: number) => void
  onChapterChange: (chapter: number) => void
  onChapterTitleChange?: (title: string) => void
  onNewPage: () => void
  onNewChapter: () => void
  className?: string
}

export function PageNavigation({
  currentPage,
  totalPages,
  currentChapter,
  totalChapters,
  chapterTitle,
  onPageChange,
  onChapterChange,
  onChapterTitleChange,
  onNewPage,
  onNewChapter,
  className
}: PageNavigationProps) {
  const [pageInput, setPageInput] = React.useState(currentPage.toString())
  const [chapterInput, setChapterInput] = React.useState(currentChapter.toString())
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [titleInput, setTitleInput] = React.useState(chapterTitle || '')

  // Update inputs when props change
  React.useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

  React.useEffect(() => {
    setChapterInput(currentChapter.toString())
  }, [currentChapter])

  React.useEffect(() => {
    setTitleInput(chapterTitle || '')
  }, [chapterTitle])

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(pageInput)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    } else {
      setPageInput(currentPage.toString()) // Reset invalid input
    }
  }

  const handleChapterInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const chapter = parseInt(chapterInput)
    if (chapter >= 1 && chapter <= totalChapters) {
      onChapterChange(chapter)
    } else {
      setChapterInput(currentChapter.toString()) // Reset invalid input
    }
  }

  const handleTitleEdit = () => {
    setIsEditingTitle(true)
  }

  const handleTitleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setIsEditingTitle(false)
    if (onChapterTitleChange && titleInput.trim() !== chapterTitle) {
      onChapterTitleChange(titleInput.trim())
    }
  }

  const handleTitleCancel = () => {
    setIsEditingTitle(false)
    setTitleInput(chapterTitle || '')
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit()
    } else if (e.key === 'Escape') {
      handleTitleCancel()
    }
  }

  const canGoPrevPage = currentPage > 1
  const canGoNextPage = currentPage < totalPages
  const canGoPrevChapter = currentChapter > 1
  const canGoNextChapter = currentChapter < totalChapters

  return (
    <div className={cn("space-y-3", className)}>
      {/* Chapter Navigation */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Chapter</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChapterChange(Math.max(1, currentChapter - 1))}
              disabled={!canGoPrevChapter}
              className="h-7 w-7 p-0"
            >
              <SkipBack className="h-3 w-3" />
            </Button>

            <form onSubmit={handleChapterInputSubmit} className="flex items-center gap-1">
              <Input
                value={chapterInput}
                onChange={(e) => setChapterInput(e.target.value)}
                className="h-7 w-12 text-center text-xs p-1"
                onBlur={handleChapterInputSubmit}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">of {totalChapters}</span>
            </form>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onChapterChange(Math.min(totalChapters, currentChapter + 1))}
              disabled={!canGoNextChapter}
              className="h-7 w-7 p-0"
            >
              <SkipForward className="h-3 w-3" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onNewChapter}
              className="h-7 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Editable Chapter Title */}
        {chapterTitle && (
          <div className="mt-2">
            {isEditingTitle ? (
              <form onSubmit={handleTitleSubmit} className="flex items-center gap-2">
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  className="text-sm flex-1"
                  placeholder="Chapter title..."
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleTitleCancel}
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <div 
                className="flex items-center gap-2 group cursor-pointer"
                onClick={handleTitleEdit}
              >
                <span className="text-lg font-bold text-center truncate flex-1">
                  {chapterTitle}
                </span>
                {onChapterTitleChange && (
                  <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Page Navigation */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Page</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={!canGoPrevPage}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>

            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
              <Input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="h-7 w-12 text-center text-xs p-1"
                onBlur={handlePageInputSubmit}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">of {totalPages}</span>
            </form>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={!canGoNextPage}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Quick Jump Pages */}
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const pageNum = i + 1
            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "ghost"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="h-6 w-6 p-0 text-xs"
              >
                {pageNum}
              </Button>
            )
          })}
          {totalPages > 10 && (
            <span className="text-xs text-muted-foreground px-1">...</span>
          )}
        </div>
      </Card>
    </div>
  )
} 