"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, Loader2, Bot, User } from 'lucide-react'
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
    chapters: number
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
        contextUsed: data.contextUsed
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
    if (contextUsed.chapters > 0) parts.push(`${contextUsed.chapters} chapters`)

    return parts.length > 0 ? `Used: ${parts.join(', ')}` : null
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
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Chat about "{actualBookTitle || 'Your Book'}"
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Ask me anything about your book content and chapters!
          </p>
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
