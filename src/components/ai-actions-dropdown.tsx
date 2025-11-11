"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sparkles, FileText, Volume2, PenLine, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import EditorAgentModal from "@/components/editor-agent-modal"

interface AIActionsDropdownProps {
  bookId: string
  className?: string
  onAnalyzeClick?: () => void
  onDraftClick?: () => void
  onAudiobookClick?: () => void
}

export function AIActionsDropdown({ 
  bookId, 
  className,
  onAnalyzeClick,
  onDraftClick,
  onAudiobookClick 
}: AIActionsDropdownProps) {
  const [showEditor, setShowEditor] = React.useState(false)
  // Stable key that only changes when modal is explicitly opened
  const [editorKey, setEditorKey] = React.useState(0)

  // Cleanup when Editor Agent closes
  React.useEffect(() => {
    if (!showEditor) {
      const timer = setTimeout(() => {
        console.log('🧹 Cleaning up Editor Agent styles...')
        document.body.removeAttribute('data-scroll-locked')
        document.body.style.removeProperty('pointer-events')
        document.body.style.removeProperty('overflow')
        document.body.style.removeProperty('padding-right')
        document.documentElement.style.removeProperty('pointer-events')
        console.log('✅ Editor Agent cleanup complete')
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [showEditor])

  const handleOpenEditor = () => {
    setEditorKey(prev => prev + 1) // Only increment when explicitly opened
    setShowEditor(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1", className)}
          >
            <Sparkles className="h-4 w-4" />
            AI Tools
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>AI Assistance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={onAnalyzeClick}
            className="cursor-pointer"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Analyze Entire Book</span>
              <span className="text-xs text-muted-foreground">
                Extract characters, locations, plot
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onDraftClick}
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Draft from Planning</span>
              <span className="text-xs text-muted-foreground">
                Generate chapters from outline
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleOpenEditor}
            className="cursor-pointer"
          >
            <PenLine className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Editor Agent</span>
              <span className="text-xs text-muted-foreground">
                AI-powered chapter editing
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={onAudiobookClick}
            className="cursor-pointer"
          >
            <Volume2 className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Audiobook</span>
              <span className="text-xs text-muted-foreground">
                Generate audio narration
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Editor Agent Modal */}
      {showEditor && (
        <EditorAgentModal
          key={editorKey}
          bookId={bookId}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              console.log('🔒 Editor Agent closing...')
              setShowEditor(false)
            }
          }}
        />
      )}
    </>
  )
}

