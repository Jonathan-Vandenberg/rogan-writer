"use client"

import * as React from "react"
import { BookPage } from "@/components/writing/book-page"
import { TypographyControls } from "@/components/writing/typography-controls"
import { PageNavigation } from "@/components/writing/page-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { useBookData } from "@/hooks/use-book-data"
import { MicrophoneButton } from "@/components/writing/microphone-button"
import { SpeechToTextProvider } from "@/hooks/use-speech-to-text"
import { 
  Save, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2,
  FileText,
  Clock,
  Target,
  BookOpen,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TypographySettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  pageWidth: number
  pageHeight: number
  marginTop: number
  marginLeft: number
  marginRight: number
  // Chapter title settings
  chapterTitleFontFamily: string
  chapterTitleFontSize: number
  chapterTitleAlignment: 'left' | 'center' | 'right'
  chapterTitlePadding: number
  showChapterTitle: boolean
  // Speech-to-text settings
  speechToTextEnabled: boolean
  speechToTextProvider: SpeechToTextProvider
  speechToTextLanguage: string
  speechToTextAutoInsert: boolean
}

export default function WritePage() {
  const { selectedBookId } = useSelectedBook()
  
  // Typography settings - initialize with defaults first
  const [typographySettings, setTypographySettings] = React.useState<TypographySettings>({
    fontFamily: "Verdana",
    fontSize: 12,
    lineHeight: 1.5,
    pageWidth: 6,
    pageHeight: 9,
    marginTop: 0.7,
    marginLeft: 1,
    marginRight: 1,
    chapterTitleFontFamily: "Verdana",
    chapterTitleFontSize: 26,
    chapterTitleAlignment: 'center',
    chapterTitlePadding: 65,
    showChapterTitle: true,
    speechToTextEnabled: false,
    speechToTextProvider: 'webspeech',
    speechToTextLanguage: 'en-US',
    speechToTextAutoInsert: true,
  })

  const {
    book,
    currentChapter,
    currentPageData,
    totalPages,
    isLoading,
    error,
    loadBook,
    updateChapterContent,
    updateChapterTitle,
    createNewChapter,
    setCurrentChapter,
    setCurrentPage,
    getCurrentChapterIndex,
    getCurrentPageIndex,
    paginationData,
  } = useBookData(typographySettings)

  // Update typography settings when book loads
  React.useEffect(() => {
    if (book) {
      setTypographySettings({
        fontFamily: book.fontFamily || "Verdana",
        fontSize: book.fontSize || 12,
        lineHeight: book.lineHeight || 1.5,
        pageWidth: book.pageWidth || 6,
        pageHeight: book.pageHeight || 9,
        marginTop: book.marginTop || 0.7,
        marginLeft: book.marginLeft || 1,
        marginRight: book.marginRight || 1,
        chapterTitleFontFamily: book.fontFamily || "Verdana",
        chapterTitleFontSize: 26,
        chapterTitleAlignment: 'center',
        chapterTitlePadding: 65,
        showChapterTitle: true,
        speechToTextEnabled: false,
        speechToTextProvider: 'webspeech',
        speechToTextLanguage: 'en-US',
        speechToTextAutoInsert: true,
      })
    }
  }, [book?.id]) // Only update when book ID changes

  // Save typography settings to database
  const saveTypographySettings = React.useCallback(async (settings: TypographySettings) => {
    if (!book?.id) return

    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageWidth: settings.pageWidth,
          pageHeight: settings.pageHeight,
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          lineHeight: settings.lineHeight,
          marginTop: settings.marginTop,
          marginLeft: settings.marginLeft,
          marginRight: settings.marginRight,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save typography settings')
      }
    } catch (error) {
      console.error('Error saving typography settings:', error)
    }
  }, [book?.id])

  // Writing state - ALL useState hooks together
  const [isDistrationFree, setIsDistrationFree] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [localContent, setLocalContent] = React.useState("")
  const [isTextareaFocused, setIsTextareaFocused] = React.useState(false)
  const [cursorPosition, setCursorPosition] = React.useState(0)
  const [isAutoNavigating, setIsAutoNavigating] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const autoNavigationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Computed values
  const currentChapterIndex = getCurrentChapterIndex()
  const currentPageIndex = getCurrentPageIndex()
  const chapterTitle = currentChapter?.title || `Chapter ${currentChapterIndex}`
  const wordCount = currentPageData?.wordCount || 0
  
  // Calculate page capacity warning
  const pageCapacityWarning = React.useMemo(() => {
    if (!currentPageData || !paginationData) return null
    
    // Use the actual pagination capacity (already includes safety margin)
    const estimatedPageCapacity = currentPageIndex === 1 
      ? (paginationData.pages[0]?.endPosition || 1000) // Don't apply additional reduction
      : ((paginationData.pages[1]?.endPosition || 1000) - (paginationData.pages[1]?.startPosition || 0))
    
    const contentLength = localContent.length
    const capacityRatio = contentLength / estimatedPageCapacity
    
    if (capacityRatio > 0.95) return 'danger' // Over 95% of pagination capacity
    if (capacityRatio > 0.85) return 'warning' // Over 85% of pagination capacity  
    return null
  }, [localContent, currentPageData, paginationData, currentPageIndex])

  // Get next page data for navigation
  const nextPageData = (paginationData?.pages || []).find((p: any) => p.pageNumber === currentPageIndex + 1)

  // Load book data when selected book changes
  React.useEffect(() => {
    if (selectedBookId) {
      loadBook(selectedBookId)
    }
  }, [selectedBookId, loadBook])

  // Initialize local content when page data changes
  React.useEffect(() => {
    if (currentPageData) {
      setLocalContent(currentPageData.content || "")
    }
  }, [currentPageData])

  // Ensure current page is valid after pagination changes
  React.useEffect(() => {
    if (totalPages > 0 && currentPageIndex > totalPages) {
      // If current page is beyond total pages, go to the last page
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPageIndex, setCurrentPage])

  // Helper function to update chapter content with page content
  const updateChapterContentWithPageContent = React.useCallback((
    chapterContent: string | undefined | null,
    startPos: number,
    endPos: number,
    newPageContent: string
  ): string => {
    const safeChapterContent = chapterContent || ''
    return safeChapterContent.substring(0, startPos) + newPageContent + safeChapterContent.substring(endPos)
  }, [])





  // Auto-save functionality (preserves user input exactly as typed)
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentChapter && currentPageData && localContent !== currentPageData.content && !isSaving) {
        setIsSaving(true)
        try {
          // Always save content exactly as user typed it - no automatic truncation
          const updatedChapterContent = updateChapterContentWithPageContent(
            currentChapter.content,
            currentPageData.startPosition,
            currentPageData.endPosition,
            localContent
          )
          await updateChapterContent(currentChapter.id, updatedChapterContent)
          setLastSaved(new Date())
        } catch (err) {
          console.error('Auto-save failed:', err)
        } finally {
          setIsSaving(false)
        }
      }
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer)
  }, [localContent, currentChapter, currentPageData, updateChapterContent, updateChapterContentWithPageContent, isSaving])



  // Handle page content changes with auto page navigation
  const handleContentChange = (content: string) => {
    setLocalContent(content)
    checkAndNavigateToCorrectPage(content)
  }

  // Check if we need to auto-navigate when typing past current page boundary
  const checkAndNavigateToCorrectPage = React.useCallback((content: string) => {
    if (!currentPageData || !paginationData || !currentChapter || !textareaRef.current || isAutoNavigating || isSaving) return

    // Clear existing timeout
    if (autoNavigationTimeoutRef.current) {
      clearTimeout(autoNavigationTimeoutRef.current)
    }

    // Debounce the check to avoid rapid navigation
    autoNavigationTimeoutRef.current = setTimeout(async () => {
      const currentPageStart = currentPageData.startPosition
      const currentPageEnd = currentPageData.endPosition
      const cursorPosition = textareaRef.current?.selectionStart || 0
      
      // Calculate absolute cursor position in the full chapter
      const absoluteCursorPosition = currentPageStart + cursorPosition
      
      // Check if cursor is beyond the current page boundary
      if (absoluteCursorPosition > currentPageEnd && cursorPosition >= content.length - 1) {
        setIsAutoNavigating(true)
        
        try {
          // Save current content first
          const updatedChapterContent = updateChapterContentWithPageContent(
            currentChapter.content,
            currentPageStart,
            currentPageEnd,
            content
          )
          
          await updateChapterContent(currentChapter.id, updatedChapterContent)
          
          // Wait a bit for pagination to recalculate
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Find which page the cursor should be on after content update
          const newPageIndex = paginationData.pages.findIndex(page => 
            absoluteCursorPosition >= page.startPosition && absoluteCursorPosition <= page.endPosition
          )
          
          if (newPageIndex >= 0 && newPageIndex + 1 !== currentPageIndex) {
            // Navigate to the correct page
            setCurrentPage(newPageIndex + 1)
            
            // Position cursor correctly on new page
            setTimeout(() => {
              if (textareaRef.current) {
                const targetPage = paginationData.pages[newPageIndex]
                const cursorOnNewPage = absoluteCursorPosition - targetPage.startPosition
                textareaRef.current.focus()
                textareaRef.current.setSelectionRange(cursorOnNewPage, cursorOnNewPage)
              }
              setIsAutoNavigating(false)
            }, 200)
          } else {
            setIsAutoNavigating(false)
          }
          
        } catch (err) {
          console.error('Auto-navigation failed:', err)
          setIsAutoNavigating(false)
        }
      }
    }, 300)
  }, [currentPageData, paginationData, currentChapter, currentPageIndex, updateChapterContent, updateChapterContentWithPageContent, setCurrentPage, isAutoNavigating, isSaving])

  // Handle speech-to-text insertion
  const handleSpeechToTextInsertion = React.useCallback((text: string) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    // Insert text at cursor position
    const newContent = localContent.slice(0, start) + text + localContent.slice(end)
    setLocalContent(newContent)
    
    // Maintain focus and set cursor position after inserted text
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
      setIsTextareaFocused(true) // Ensure focus state is correct
    }, 10)
  }, [localContent])

  // Handle textarea focus/blur with delay for microphone button clicks
  const handleTextareaFocus = React.useCallback(() => {
    setIsTextareaFocused(true)
  }, [])

  const handleTextareaBlur = React.useCallback(() => {
    // Add a small delay before marking as unfocused to allow microphone button clicks
    setTimeout(() => {
      if (document.activeElement !== textareaRef.current) {
        setIsTextareaFocused(false)
      }
    }, 100)
  }, [])

  // Handle cursor position changes
  const handleCursorPositionChange = React.useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart)
    }
  }, [])

  // Navigation handlers
  const handlePageChange = async (pageIndex: number) => {
    // Ensure we don't navigate to a page that doesn't exist
    if (pageIndex < 1 || pageIndex > totalPages) {
      console.warn(`Attempted to navigate to invalid page: ${pageIndex}. Total pages: ${totalPages}`)
      return
    }

    // Save current content before switching pages
    if (currentChapter && currentPageData && localContent !== currentPageData.content && !isSaving) {
      setIsSaving(true)
      try {
        const updatedChapterContent = updateChapterContentWithPageContent(
          currentChapter.content,
          currentPageData.startPosition,
          currentPageData.endPosition,
          localContent
        )
        await updateChapterContent(currentChapter.id, updatedChapterContent)
        setLastSaved(new Date())
      } catch (err) {
        console.error('Failed to save before page switch:', err)
      } finally {
        setIsSaving(false)
      }
    }

    setCurrentPage(pageIndex)
  }

  const handleChapterChange = async (chapterIndex: number) => {
    // Save current content before switching chapters
    if (currentChapter && currentPageData && localContent !== currentPageData.content && !isSaving) {
      setIsSaving(true)
      try {
        const updatedChapterContent = updateChapterContentWithPageContent(
          currentChapter.content,
          currentPageData.startPosition,
          currentPageData.endPosition,
          localContent
        )
        await updateChapterContent(currentChapter.id, updatedChapterContent)
        setLastSaved(new Date())
      } catch (err) {
        console.error('Failed to save before chapter switch:', err)
      } finally {
        setIsSaving(false)
      }
    }

    if (book && book.chapters[chapterIndex - 1]) {
      setCurrentChapter(book.chapters[chapterIndex - 1].id)
    }
  }

  const handleNewPage = () => {
    // Move to the last page where content ends and position cursor at the end
    if (currentChapter && totalPages > 0) {
      const lastPage = paginationData?.pages[totalPages - 1]
      if (lastPage) {
        setCurrentPage(totalPages)
        // Position cursor at the end of content
        setTimeout(() => {
          if (textareaRef.current) {
            const content = lastPage.content || ''
            textareaRef.current.focus()
            textareaRef.current.setSelectionRange(content.length, content.length)
          }
        }, 100)
      }
    }
  }

  const handleNewChapter = async () => {
    if (book) {
      try {
        const newChapter = await createNewChapter(book.id, `Chapter ${book.chapters.length + 1}`)
        setCurrentChapter(newChapter.id)
      } catch (err) {
        console.error('Failed to create new chapter:', err)
      }
    }
  }

  const handleChapterTitleChange = async (newTitle: string) => {
    if (!currentChapter) return

    try {
      setIsSaving(true)
      await updateChapterTitle(currentChapter.id, newTitle)
      setLastSaved(new Date())
    } catch (err) {
      console.error('Failed to update chapter title:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Save manually
  const handleSave = async () => {
    if (currentChapter && currentPageData && localContent !== currentPageData.content && !isSaving) {
      setIsSaving(true)
      try {
        const updatedChapterContent = updateChapterContentWithPageContent(
          currentChapter.content,
          currentPageData.startPosition,
          currentPageData.endPosition,
          localContent
        )
        await updateChapterContent(currentChapter.id, updatedChapterContent)
        setLastSaved(new Date())
      } catch (err) {
        console.error('Manual save failed:', err)
      } finally {
        setIsSaving(false)
      }
    }
  }

  // Toggle distraction-free mode
  const toggleDistractionFree = () => {
    setIsDistrationFree(!isDistrationFree)
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (!isFullscreen) {
      setIsDistrationFree(true)
    }
  }

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (autoNavigationTimeoutRef.current) {
        clearTimeout(autoNavigationTimeoutRef.current)
      }
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Loading book...</h2>
          <p className="text-muted-foreground">Please wait while we load your book data.</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Error loading book</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => selectedBookId && loadBook(selectedBookId)}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // No book selected
  if (!selectedBookId || !book) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold">No book selected</h2>
          <p className="text-muted-foreground">Please select a book from the dropdown to start writing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "min-h-screen bg-gray-50 dark:bg-gray-900",
      isFullscreen && "fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-auto"
    )}>
      {/* Header */}
      {!isDistrationFree && (
        <div className="border-b bg-white dark:bg-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold">Writing Mode</h1>
                <p className="text-sm text-muted-foreground">
                  {book.title} - {chapterTitle}
                </p>
              </div>
              
              {/* Writing Stats */}
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {wordCount} words
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Target className="h-3 w-3" />
                  Page {currentPageIndex}
                </Badge>
                {/* {pageCapacityWarning && (
                  <Badge 
                    variant={pageCapacityWarning === 'danger' ? 'destructive' : 'outline'} 
                    className="gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {pageCapacityWarning === 'danger' ? 'Page Full' : 'Page Nearly Full'}
                  </Badge>
                )} */}
                {lastSaved && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Saved {lastSaved.toLocaleTimeString()}
                  </Badge>
                )}
                {isSaving && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3 animate-spin" />
                    Saving...
                  </Badge>
                )}
                {isAutoNavigating && (
                  <Badge variant="outline" className="gap-1">
                    <Target className="h-3 w-3 animate-pulse" />
                    Moving to next page...
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {typographySettings.speechToTextEnabled && (
                <MicrophoneButton
                  provider={typographySettings.speechToTextProvider}
                  language={typographySettings.speechToTextLanguage}
                  autoInsert={typographySettings.speechToTextAutoInsert}
                  isTextareaFocused={isTextareaFocused}
                  onTextReceived={handleSpeechToTextInsertion}
                  size="sm"
                  variant="outline"
                />
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleDistractionFree}
                className="gap-1"
              >
                {isDistrationFree ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Focus
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="gap-1"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isFullscreen ? "Exit" : "Fullscreen"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={cn(
        "flex gap-6 p-6",
        isDistrationFree && "justify-center items-center min-h-screen p-12"
      )}>
        {/* Sidebar Controls */}
        {!isDistrationFree && (
          <div className="w-88 space-y-6">
            {/* Typography Controls */}
            <TypographyControls
              settings={typographySettings}
              onSettingsChange={(newSettings) => {
                setTypographySettings(newSettings)
                saveTypographySettings(newSettings)
              }}
            />

            {/* Page Navigation */}
            <PageNavigation
              currentPage={currentPageIndex}
              totalPages={totalPages}
              currentChapter={currentChapterIndex}
              totalChapters={book.chapters.length}
              chapterTitle={chapterTitle}
              onPageChange={handlePageChange}
              onChapterChange={handleChapterChange}
              onChapterTitleChange={handleChapterTitleChange}
              onNewPage={handleNewPage}
              onNewChapter={handleNewChapter}
            />

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Session Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current book:</span>
                  <span className="font-medium">{book.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Chapters:</span>
                  <span className="font-medium">{book.chapters.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pages:</span>
                  <span className="font-medium">{totalPages}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize">{book.status.replace('_', ' ')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Book Page */}
        <div className="flex-1 flex flex-col items-center">
          <BookPage
            content={localContent}
            pageNumber={currentPageIndex}
            pageWidth={typographySettings.pageWidth}
            pageHeight={typographySettings.pageHeight}
            fontSize={typographySettings.fontSize}
            fontFamily={typographySettings.fontFamily}
            lineHeight={typographySettings.lineHeight}
            marginTop={typographySettings.marginTop}
            marginLeft={typographySettings.marginLeft}
            marginRight={typographySettings.marginRight}
            chapterTitle={chapterTitle}
            showChapterTitle={typographySettings.showChapterTitle}
            chapterTitleFontFamily={typographySettings.chapterTitleFontFamily}
            chapterTitleFontSize={typographySettings.chapterTitleFontSize}
            chapterTitleAlignment={typographySettings.chapterTitleAlignment}
            chapterTitlePadding={typographySettings.chapterTitlePadding}
            isFirstPageOfChapter={currentPageIndex === 1}
            onContentChange={handleContentChange}
            // Page navigation - single page mode only
            onPreviousPage={currentPageIndex > 1 ? () => handlePageChange(currentPageIndex - 1) : undefined}
            onNextPage={currentPageIndex < totalPages ? () => handlePageChange(currentPageIndex + 1) : undefined}
            // Speech-to-text support
            textareaRef={textareaRef}
            onTextareaFocus={handleTextareaFocus}
            onTextareaBlur={handleTextareaBlur}
            onCursorPositionChange={handleCursorPositionChange}
            className={cn(
              "transition-all duration-300",
              isDistrationFree && "scale-110"
            )}
          />

          {/* Distraction-free mode controls */}
          {isDistrationFree && (
            <div className="mt-8 flex items-center gap-4">
              <Button
                variant="outline"
                onClick={toggleDistractionFree}
                className="gap-1"
              >
                <Eye className="h-4 w-4" />
                Show Tools
              </Button>
              
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Page {currentPageIndex} • {wordCount} words
                </div>
                {pageCapacityWarning && (
                  <Badge 
                    variant={pageCapacityWarning === 'danger' ? 'destructive' : 'outline'} 
                    className="gap-1 text-xs"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {pageCapacityWarning === 'danger' ? 'Page Full' : 'Nearly Full'}
                  </Badge>
                )}
                {isAutoNavigating && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Target className="h-3 w-3 animate-pulse" />
                    Moving to next page...
                  </Badge>
                )}
              </div>

              {typographySettings.speechToTextEnabled && (
                <MicrophoneButton
                  provider={typographySettings.speechToTextProvider}
                  language={typographySettings.speechToTextLanguage}
                  autoInsert={typographySettings.speechToTextAutoInsert}
                  isTextareaFocused={isTextareaFocused}
                  onTextReceived={handleSpeechToTextInsertion}
                  variant="outline"
                />
              )}
              
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 