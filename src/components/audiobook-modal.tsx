"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Volume2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import AudiobookManager from '@/components/audiobook-manager'
import { cn } from '@/lib/utils'

interface AudiobookModalProps {
  bookId: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function AudiobookModal({ bookId, className = '', open: controlledOpen, onOpenChange }: AudiobookModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn("gap-1", className)}
          >
            <Volume2 className="h-4 w-4" />
            Audiobook
          </Button>
        </DialogTrigger>
      )}
      <DialogContent 
        className="!max-w-none w-[70vw] max-h-[90vh] overflow-y-auto" 
        style={{ width: '50vw', maxWidth: 'none' }}
      >
        <DialogHeader>
          <DialogTitle>Audiobook Generator</DialogTitle>
          <DialogDescription>
            Generate high-quality audio narration for your book chapters
          </DialogDescription>
        </DialogHeader>
        <AudiobookManager bookId={bookId} />
      </DialogContent>
    </Dialog>
  )
}

