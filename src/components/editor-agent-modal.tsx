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
  const [editorModel, setEditorModel] = useState<string>('openai/gpt-4')
  const [clearHistoryTrigger, setClearHistoryTrigger] = useState(0)

  // Load user's preferred editor model from settings when modal opens
  React.useEffect(() => {
    if (open) {
      const loadUserSettings = async () => {
        try {
          const response = await fetch('/api/user/settings')
          if (response.ok) {
            const data = await response.json()
            // Use user's preferred editor model if set, otherwise use default
            if (data.openRouterEditorModel) {
              setEditorModel(data.openRouterEditorModel)
              console.log(`✅ Loaded user's preferred editor model: ${data.openRouterEditorModel}`)
            } else {
              setEditorModel('openai/gpt-4')
            }
          }
        } catch (error) {
          console.error('Error loading user settings:', error)
        }
      }
      loadUserSettings()
    }
  }, [open])

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
                AI-powered chapter editing. Chat with the AI to edit your chapters, 
                and review changes before accepting them. Configure your model in Settings.
              </DialogDescription>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-4 ml-4">
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
            editorModel={editorModel} 
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

