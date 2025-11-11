"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, Loader2, Bot, User, BookOpen, Lightbulb, Target, Users, MapPin, Calendar, Bookmark, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  contextUsed?: {
    totalChunks: number
    chapters: number
    characters: number
    locations: number
    plotPoints: number
    timeline: number
    brainstorming: number
    scenes: number
    research: number
  }
  sources?: {
    chapters: Array<{ title: string; chapterNumber: number; similarity: number }>
    characters: Array<{ name: string; role: string; similarity: number }>
    locations: Array<{ name: string; similarity: number }>
    plotPoints: Array<{ title: string; type: string; similarity: number }>
    timeline: Array<{ title: string; eventDate: string; similarity: number }>
    brainstorming: Array<{ title: string; tags: string[]; similarity: number }>
    scenes: Array<{ title: string; similarity: number }>
    research: Array<{ title: string; similarity: number }>
  }
}

interface AIBookChatProps {
  bookId: string
  bookTitle?: string
  className?: string
}

export default function AIBookChat({ bookId, bookTitle, className }: AIBookChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [actualBookTitle, setActualBookTitle] = useState<string | undefined>(bookTitle)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch book title if not provided
  useEffect(() => {
    if (!bookTitle && bookId) {
      fetch('/api/books')
        .then(res => res.json())
        .then(books => {
          const book = books.find((b: any) => b.id === bookId)
          if (book?.title) {
            setActualBookTitle(book.title)
          }
        })
        .catch(console.error)
    } else {
      setActualBookTitle(bookTitle)
    }
  }, [bookId, bookTitle])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const regenerateEmbeddings = async () => {
    setIsRegenerating(true)
    try {
      const response = await fetch(`/api/books/${bookId}/embeddings/regenerate`, {
        method: 'POST',
      })
      const data = await response.json()
      
      if (response.ok) {
        // Add a system message to show success
        const systemMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: `✅ Successfully regenerated embeddings! Now I can search across all your content:\n\n${Object.entries(data.stats || {}).map(([type, count]) => `- ${type}: ${count} chunks`).join('\n')}`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, systemMessage])
      } else {
        throw new Error(data.error || 'Failed to regenerate embeddings')
      }
    } catch (error) {
      console.error('Error regenerating embeddings:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Failed to regenerate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsRegenerating(false)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/books/${bookId}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        contextUsed: data.contextUsed,
        sources: data.sources
      }

      setMessages(prev => [...prev, aiMessage])

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatContextInfo = (contextUsed?: ChatMessage['contextUsed']) => {
    if (!contextUsed) return null

    const parts = []
    if (contextUsed.chapters > 0) parts.push(`${contextUsed.chapters} chapter${contextUsed.chapters > 1 ? 's' : ''}`)
    if (contextUsed.characters > 0) parts.push(`${contextUsed.characters} character${contextUsed.characters > 1 ? 's' : ''}`)
    if (contextUsed.locations > 0) parts.push(`${contextUsed.locations} location${contextUsed.locations > 1 ? 's' : ''}`)
    if (contextUsed.plotPoints > 0) parts.push(`${contextUsed.plotPoints} plot point${contextUsed.plotPoints > 1 ? 's' : ''}`)
    if (contextUsed.timeline > 0) parts.push(`${contextUsed.timeline} timeline event${contextUsed.timeline > 1 ? 's' : ''}`)
    if (contextUsed.brainstorming > 0) parts.push(`${contextUsed.brainstorming} idea${contextUsed.brainstorming > 1 ? 's' : ''}`)
    if (contextUsed.scenes > 0) parts.push(`${contextUsed.scenes} scene${contextUsed.scenes > 1 ? 's' : ''}`)
    if (contextUsed.research > 0) parts.push(`${contextUsed.research} research${contextUsed.research > 1 ? ' items' : ' item'}`)

    return parts.length > 0 ? `Used: ${parts.join(', ')}` : null
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'Chapter': return <BookOpen className="w-3.5 h-3.5 text-blue-500" />
      case 'Character': return <Users className="w-3.5 h-3.5 text-purple-500" />
      case 'Location': return <MapPin className="w-3.5 h-3.5 text-red-500" />
      case 'Plot': return <Target className="w-3.5 h-3.5 text-pink-500" />
      case 'Timeline': return <Calendar className="w-3.5 h-3.5 text-orange-500" />
      case 'Idea': return <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
      case 'Scene': return <Bookmark className="w-3.5 h-3.5 text-green-500" />
      case 'Research': return <FileText className="w-3.5 h-3.5 text-indigo-500" />
      default: return <FileText className="w-3.5 h-3.5 text-gray-500" />
    }
  }

  const renderSources = (sources: ChatMessage['sources']) => {
    if (!sources) return null
    
    const allSources = [
      ...sources.chapters.map(s => ({ type: 'Chapter', name: `Ch. ${s.chapterNumber}: ${s.title}`, similarity: s.similarity })),
      ...sources.characters.map(s => ({ type: 'Character', name: s.name, similarity: s.similarity })),
      ...sources.locations.map(s => ({ type: 'Location', name: s.name, similarity: s.similarity })),
      ...sources.plotPoints.map(s => ({ type: 'Plot', name: s.title, similarity: s.similarity })),
      ...sources.timeline.map(s => ({ type: 'Timeline', name: s.title, similarity: s.similarity })),
      ...sources.brainstorming.map(s => ({ type: 'Idea', name: s.title, similarity: s.similarity })),
      ...sources.scenes.map(s => ({ type: 'Scene', name: s.title, similarity: s.similarity })),
      ...sources.research.map(s => ({ type: 'Research', name: s.title, similarity: s.similarity })),
    ].sort((a, b) => b.similarity - a.similarity).slice(0, 8) // Top 8 sources
    
    if (allSources.length === 0) return null
    
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-medium text-muted-foreground mb-2">Sources used:</p>
        <div className="flex flex-wrap gap-1.5">
          {allSources.map((source, idx) => (
            <div 
              key={idx}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border/50 text-xs"
              title={`${source.type}: ${source.name} (${(source.similarity * 100).toFixed(1)}% match)`}
            >
              <span className="flex-shrink-0">
                {getSourceIcon(source.type)}
              </span>
              <span className="text-muted-foreground truncate max-w-[200px]">{source.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="default"
          className={cn("flex items-center gap-2", className)}
        >
          <MessageCircle className="h-4 w-4" />
          Ask about book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[90vw] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                Chat about "{actualBookTitle || 'Your Book'}"
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ask me anything about your book content and chapters!
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateEmbeddings}
              disabled={isRegenerating}
              className="flex items-center gap-2"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  Index Book
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Hi! I'm your AI writing assistant. I have access to your book content, characters, plot points, and notes.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ask me anything about your story!
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === 'user' 
                      ? "bg-blue-600 text-white" 
                      : "bg-muted"
                  )}>
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none 
                          prose-p:my-3 prose-p:leading-relaxed
                          prose-headings:mt-4 prose-headings:mb-2
                          prose-ul:my-2 prose-ol:my-2
                          prose-li:my-1">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              // Custom paragraph component to handle line breaks properly
                              p: ({ children }) => <p className="mb-2">{children}</p>,
                              br: () => <br className="my-1" />
                            }}
                          >
                            {message.content.replace(/\\n/g, '\n')}
                          </ReactMarkdown>
                        </div>
                        {renderSources(message.sources)}
                      </>
                    )}
                    <div className={cn(
                      "flex items-center gap-2 mt-2 text-xs",
                      message.role === 'user' 
                        ? "text-blue-100" 
                        : "text-muted-foreground"
                    )}>
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      {message.contextUsed && formatContextInfo(message.contextUsed) && (
                        <span className="opacity-75">
                          • {formatContextInfo(message.contextUsed)}
                        </span>
                      )}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Reading your book...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t bg-background flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about your book..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send • The AI can see your book content and planning materials
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
