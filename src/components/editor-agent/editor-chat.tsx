"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Loader2, 
  Bot, 
  User, 
  BookOpen, 
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorChanges } from '@/hooks/use-editor-changes';
import { ChangeReview } from './change-review';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  chaptersLoaded?: Array<{ id: string; title: string }>;
}

interface EditorChatProps {
  bookId: string;
  includePlanningData: boolean;
  editorModel: string;
}

export const EditorChat = React.memo(function EditorChat({ bookId, includePlanningData, editorModel }: EditorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [loadedChapterIds, setLoadedChapterIds] = useState<string[]>([]);
  const [bookTitle, setBookTitle] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const editorChanges = useEditorChanges(bookId);

  // Fetch book title, load all chapters, and restore chat history on mount
  useEffect(() => {
    const fetchBookAndChapters = async () => {
      try {
        // Fetch chat history first
        const historyResponse = await fetch(`/api/books/${bookId}/editor-chat-history`);
        let existingMessages: ChatMessage[] = [];
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          if (historyData.messages && historyData.messages.length > 0) {
            existingMessages = historyData.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
            console.log(`💬 Restored ${existingMessages.length} messages from chat history`);
          }
        }

        const response = await fetch(`/api/books/${bookId}`);
        if (response.ok) {
          const book = await response.json();
          setBookTitle(book.title);
          
          // Auto-load all chapters with content
          if (book.chapters && book.chapters.length > 0) {
            const chapterIds = book.chapters
              .filter((ch: any) => ch.content && ch.content.trim().length > 0)
              .map((ch: any) => ch.id);
            
            if (chapterIds.length > 0) {
              setLoadedChapterIds(chapterIds);
              console.log(`📚 Auto-loaded ${chapterIds.length} chapters on modal open`, chapterIds);
              
              // If we have existing messages, use them
              if (existingMessages.length > 0) {
                setMessages(existingMessages);
              } else {
                // Add initial message showing chapters are loaded
                const chapterList = book.chapters
                  .map((ch: any, idx: number) => `${idx + 1}. ${ch.title}`)
                  .join('\n');
                
                const initialMessage: ChatMessage = {
                  id: `system-${Date.now()}`,
                  role: 'assistant',
                  content: `✅ **Ready to Edit!**\n\nI have full access to all ${chapterIds.length} chapters of *"${book.title}"*:\n\n${chapterList}\n\n${includePlanningData ? '📋 **Planning data is loaded** (plot, characters, locations, etc.)\n\n' : ''}How can I help you edit your book?`,
                  timestamp: new Date(),
                  chaptersLoaded: book.chapters.map((ch: any) => ({ id: ch.id, title: ch.title })),
                };
                setMessages([initialMessage]);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching book:', error);
      }
    };
    fetchBookAndChapters();
  }, [bookId, includePlanningData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-save chat history whenever messages change (debounced)
  useEffect(() => {
    if (messages.length === 0) return;

    const saveTimeout = setTimeout(async () => {
      try {
        await fetch(`/api/books/${bookId}/editor-chat-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        });
        console.log('💾 Auto-saved chat history');
      } catch (error) {
        console.error('Error saving chat history:', error);
      }
    }, 1000); // Debounce by 1 second

    return () => clearTimeout(saveTimeout);
  }, [messages, bookId]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/books/${bookId}/editor-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          loadedChapterIds,
          includePlanningData,
          editorModel,
        }),
      });

      console.log('📤 Sending to editor-agent:', { 
        loadedChapterIds, 
        includePlanningData, 
        editorModel,
        chapterIdsCount: loadedChapterIds?.length || 0
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get AI response');
      }

      // Handle streaming response (currently disabled)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        console.log('📡 Receiving streamed response...');
        
        // Create a message for streaming content
        const streamMessageId = `ai-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: streamMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }]);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let isGeneratingEdits = false;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.chunk) {
                    const textChunk = data.chunk;
                    
                    // Check if we're entering JSON territory
                    // Look for common JSON patterns that indicate the reasoning is done
                    if (!isGeneratingEdits) {
                      // Check if this chunk or accumulated content contains JSON start
                      const testContent = accumulatedContent + textChunk;
                      
                      // Look for JSON object start with type/edits/message fields
                      if (testContent.includes('{\n') || 
                          testContent.includes('{ ') ||
                          (testContent.includes('{') && (
                            testContent.includes('"type"') || 
                            testContent.includes('"edits"') || 
                            testContent.includes('"message"') ||
                            testContent.includes('"chapterId"')
                          ))) {
                        
                        // Extract only the content before the JSON
                        const jsonStartIndex = testContent.lastIndexOf('{');
                        if (jsonStartIndex > 0) {
                          // Keep only content before the JSON
                          accumulatedContent = testContent.substring(0, jsonStartIndex).trim();
                        }
                        
                        isGeneratingEdits = true;
                        // Update message to show we're processing edits
                        setMessages(prev => prev.map(msg => 
                          msg.id === streamMessageId 
                            ? { ...msg, content: accumulatedContent + '\n\n⚙️ **Generating edits...**' }
                            : msg
                        ));
                        continue; // Skip adding JSON to content
                      }
                    }
                    
                    // If we're in JSON mode, skip all content
                    if (isGeneratingEdits) {
                      continue;
                    }
                    
                    // Otherwise, accumulate the reasoning/explanation
                    accumulatedContent += textChunk;
                    setMessages(prev => prev.map(msg => 
                      msg.id === streamMessageId 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    ));
                  }
                  
                  if (data.parsedData) {
                    console.log('📦 Received parsed data with edits');
                    
                    // Update message to show edits are ready
                    setMessages(prev => prev.map(msg => 
                      msg.id === streamMessageId 
                        ? { ...msg, content: accumulatedContent + '\n\n✅ **Edits ready for review** →' }
                        : msg
                    ));
                    
                    // Add changes to review if present
                    if (data.parsedData.edits && data.parsedData.edits.length > 0) {
                      console.log('✏️ Adding edits to review:', data.parsedData.edits.length);
                      editorChanges.addChanges(
                        data.parsedData.edits.map((edit: any, index: number) => ({
                          id: `edit-${Date.now()}-${index}-${edit.chapterId}-${Math.random().toString(36).substr(2, 9)}`,
                          chapterId: edit.chapterId,
                          chapterTitle: data.chaptersLoaded?.find((ch: any) => ch.id === edit.chapterId)?.title || 'Chapter',
                          originalContent: edit.originalContent,
                          editedContent: edit.editedContent,
                          diff: edit.diff,
                          description: edit.reasoning,
                        }))
                      );
                    }
                    
                    // Add new chapters to review if present
                    if (data.parsedData.newChapters && data.parsedData.newChapters.length > 0) {
                      console.log('➕ Adding new chapters to review:', data.parsedData.newChapters.length);
                      editorChanges.addNewChapters(
                        data.parsedData.newChapters.map((chapter: any, index: number) => ({
                          id: `new-chapter-${Date.now()}-${index}-${chapter.title}-${Math.random().toString(36).substr(2, 9)}`,
                          title: chapter.title,
                          content: chapter.content,
                          orderIndex: chapter.orderIndex,
                          description: chapter.reasoning,
                        }))
                      );
                    }
                  }
                  
                  if (data.done) {
                    console.log('✅ Streaming complete');
                  }
                  
                  if (data.error) {
                    throw new Error(data.error);
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        }

        setIsLoading(false);
        return;
      }

      // Handle non-streaming response
      const data = await response.json();
      console.log('📥 Editor Agent Response:', data);
      console.log('📥 Response type:', typeof data);
      console.log('📥 Response keys:', Object.keys(data));
      console.log('📥 Has message?', !!data.message);
      console.log('📥 Has error?', !!data.error);

      // Check for error in response
      if (data.error) {
        throw new Error(data.error);
      }

      // Add AI response to messages
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.message || data.content || 'Processing your request...',
        timestamp: new Date(),
        chaptersLoaded: data.chaptersLoaded,
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update loaded chapters
      if (data.chaptersLoaded && data.chaptersLoaded.length > 0) {
        setLoadedChapterIds(data.chaptersLoaded.map((ch: any) => ch.id));
        console.log('📚 Loaded chapters:', data.chaptersLoaded.length);
      }

      // Add changes to review if present
      if (data.edits && data.edits.length > 0) {
        console.log('✏️ Adding edits to review:', data.edits.length);
        editorChanges.addChanges(
          data.edits.map((edit: any, index: number) => ({
            id: `edit-${Date.now()}-${index}-${edit.chapterId}-${Math.random().toString(36).substr(2, 9)}`,
            chapterId: edit.chapterId,
            chapterTitle: data.chaptersLoaded?.find((ch: any) => ch.id === edit.chapterId)?.title || 'Chapter',
            originalContent: edit.originalContent,
            editedContent: edit.editedContent,
            diff: edit.diff,
            description: edit.reasoning,
          }))
        );
      }

      // Add new chapters to review if present
      if (data.newChapters && data.newChapters.length > 0) {
        console.log('➕ Adding new chapters to review:', data.newChapters.length);
        editorChanges.addNewChapters(
          data.newChapters.map((chapter: any, index: number) => ({
            id: `new-chapter-${Date.now()}-${index}-${chapter.title}-${Math.random().toString(36).substr(2, 9)}`,
            title: chapter.title,
            content: chapter.content,
            orderIndex: chapter.orderIndex,
            description: chapter.reasoning,
          }))
        );
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      
      const errorContent = error instanceof Error 
        ? `Sorry, I encountered an error: ${error.message}` 
        : 'Sorry, I encountered an error while processing your request. Please try again.';
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyAcceptedChanges = async () => {
    const acceptedChanges = editorChanges.getAcceptedChanges();
    const acceptedNewChapters = editorChanges.getAcceptedNewChapters();

    if (acceptedChanges.length === 0 && acceptedNewChapters.length === 0) {
      return;
    }

    setIsApplying(true);

    try {
      const response = await fetch(`/api/books/${bookId}/apply-editor-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes: acceptedChanges.map(change => ({
            chapterId: change.chapterId,
            newContent: change.editedContent,
          })),
          newChapters: acceptedNewChapters.map(chapter => ({
            title: chapter.title,
            content: chapter.content,
            orderIndex: chapter.orderIndex,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply changes');
      }

      // Show success message
      const successMessage: ChatMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: `✅ ${data.message} Your changes have been saved!`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);

      // Clear all changes
      editorChanges.clearChanges();
    } catch (error) {
      console.error('Error applying changes:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Failed to apply changes. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat panel */}
      <div className="flex flex-col w-1/2 border-r h-full">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <h3 className="font-semibold">{bookTitle || 'Loading...'}</h3>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {loadedChapterIds.length > 0 && (
              <Badge variant="secondary">
                {loadedChapterIds.length} chapters loaded
              </Badge>
            )}
            {includePlanningData && (
              <Badge variant="default" className="bg-green-500">
                Planning Data Enabled
              </Badge>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-full text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Welcome to Editor Agent</h3>
                <p className="text-sm max-w-md">
                  I'm powered by Grok 4 Fast and ready to help you edit your chapters. 
                  Tell me what you'd like to improve, and I'll suggest changes for you to review.
                </p>
                <div className="mt-4 text-xs space-y-1">
                  <p>Try asking:</p>
                  <p className="italic">"Improve the dialogue in chapter 3"</p>
                  <p className="italic">"Make the opening scene more engaging"</p>
                  <p className="italic">"Fix pacing issues throughout the book"</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[80%]",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkBreaks]}
                        components={{
                          p: ({ children }) => <p className="whitespace-pre-wrap mb-2">{children}</p>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    {message.chaptersLoaded && message.chaptersLoaded.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs opacity-70">
                          Loaded: {message.chaptersLoaded.map(ch => ch.title).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="rounded-lg px-4 py-2 bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe the changes you want to make..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Changes review panel */}
      <div className="flex flex-col w-1/2 h-full">
        <div className="flex-shrink-0 p-4 border-b bg-muted/30 flex items-center justify-between">
          {editorChanges.acceptedCount > 0 && (
            <Button
              onClick={applyAcceptedChanges}
              disabled={isApplying}
              className="gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Apply {editorChanges.acceptedCount} Changes
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <ChangeReview
            changes={editorChanges.changes}
            newChapters={editorChanges.newChapters}
            currentChangeIndex={editorChanges.currentChangeIndex}
            onAcceptChange={editorChanges.acceptChange}
            onRejectChange={editorChanges.rejectChange}
            onAcceptNewChapter={editorChanges.acceptNewChapter}
            onRejectNewChapter={editorChanges.rejectNewChapter}
            onAcceptAll={editorChanges.acceptAll}
            onRejectAll={editorChanges.rejectAll}
            onNextChange={editorChanges.goToNextChange}
            onPreviousChange={editorChanges.goToPreviousChange}
            pendingCount={editorChanges.pendingCount}
            acceptedCount={editorChanges.acceptedCount}
            pendingNewChaptersCount={editorChanges.pendingNewChaptersCount}
          />
        </div>
      </div>
    </div>
  );
});

