"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EditorChat } from '@/components/editor-agent/editor-chat'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BookOpen, Trash2 } from 'lucide-react'

interface EditorAgentModalProps {
  bookId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditorAgentModal({ bookId, open, onOpenChange }: EditorAgentModalProps) {
  const [includePlanningData, setIncludePlanningData] = useState(false)
  const [grokModel, setGrokModel] = useState<'grok-4-fast-non-reasoning' | 'grok-4-fast-reasoning'>('grok-4-fast-non-reasoning')
  const [clearHistoryTrigger, setClearHistoryTrigger] = useState(0)

  const handleClearHistory = async () => {
    if (confirm('Clear all chat history? This cannot be undone.')) {
      try {
        await fetch(`/api/books/${bookId}/editor-chat-history`, {
          method: 'DELETE',
        });
        // Trigger re-mount of EditorChat to reset messages
        setClearHistoryTrigger(prev => prev + 1);
      } catch (error) {
        console.error('Error clearing history:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] w-[90vw] h-[95vh] flex flex-col p-0" 
        style={{ width: '90vw', maxWidth: 'none' }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">Editor Agent</DialogTitle>
              <DialogDescription>
                AI-powered chapter editing using Grok 4 Fast. Chat with the AI to edit your chapters, 
                and review changes before accepting them.
              </DialogDescription>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-4 ml-4">
              {/* Model Selector */}
              <div className="flex items-center space-x-2">
                <Label htmlFor="model-select" className="text-sm whitespace-nowrap">
                  Model:
                </Label>
                <select
                  id="model-select"
                  value={grokModel}
                  onChange={(e) => setGrokModel(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1 bg-background"
                >
                  <option value="grok-4-fast-non-reasoning">Fast (No Reasoning)</option>
                  <option value="grok-4-fast-reasoning">Fast (With Reasoning)</option>
                </select>
              </div>
              
              {/* Planning Data Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="planning-toggle"
                  checked={includePlanningData}
                  onCheckedChange={setIncludePlanningData}
                />
                <Label 
                  htmlFor="planning-toggle" 
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  Include Planning Data
                </Label>
              </div>

              {/* Clear History Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <EditorChat 
            key={clearHistoryTrigger} 
            bookId={bookId} 
            includePlanningData={includePlanningData} 
            grokModel={grokModel} 
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

