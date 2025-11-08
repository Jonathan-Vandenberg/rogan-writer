"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { autoPagination, type PaginationConfig, type PaginationState } from "@/lib/auto-pagination"

interface AutoPaginatedBookPageProps {
  content: string
  onContentChange?: (content: string) => void
  pageWidth?: number
  pageHeight?: number
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  chapterTitle?: string
  showChapterTitle?: boolean
  chapterTitleFontFamily?: string
  chapterTitleFontSize?: number
  chapterTitleAlignment?: 'left' | 'center' | 'right'
  chapterTitlePadding?: number
  className?: string
  // Speech-to-text support
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onTextareaFocus?: () => void
  onTextareaBlur?: () => void
  onCursorPositionChange?: () => void
  // Callbacks
  onPageChange?: (pageIndex: number, totalPages: number) => void
}

export function AutoPaginatedBookPage({
  content,
  onContentChange,
  pageWidth = 6,
  pageHeight = 9,
  fontSize = 16,
  fontFamily = "Verdana",
  lineHeight = 1.5,
  marginTop = 0.7,
  marginBottom = 0.7,
  marginLeft = 0.7,
  marginRight = 0.7,
  chapterTitle,
  showChapterTitle = true,
  chapterTitleFontFamily,
  chapterTitleFontSize = 26,
  chapterTitleAlignment = 'center',
  chapterTitlePadding = 65,
  className,
  textareaRef,
  onTextareaFocus,
  onTextareaBlur,
  onCursorPositionChange,
  onPageChange,
}: AutoPaginatedBookPageProps) {
  const [paginationState, setPaginationState] = React.useState<PaginationState>({
    pages: [],
    currentPageIndex: 0,
    totalPages: 0,
    isRecalculating: false,
  })
  
  const [currentPageIndex, setCurrentPageIndex] = React.useState(0)
  const [localContent, setLocalContent] = React.useState(content)
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Initialize pagination manager
  React.useEffect(() => {
    const config: PaginationConfig = {
      pageWidth,
      pageHeight,
      fontSize,
      fontFamily,
      lineHeight,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      chapterTitle,
      chapterTitleFontSize,
      chapterTitlePadding,
      showChapterTitle,
    }

    autoPagination.initialize(config, content)
    setIsInitialized(true)

    // Subscribe to pagination state changes
    const unsubscribe = autoPagination.subscribe((state) => {
      setPaginationState(state)
      
      // Notify parent of page changes
      if (onPageChange) {
        onPageChange(state.currentPageIndex, state.totalPages)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [
    pageWidth, pageHeight, fontSize, fontFamily, lineHeight,
    marginTop, marginBottom, marginLeft, marginRight,
    chapterTitle, chapterTitleFontSize, chapterTitlePadding, showChapterTitle,
    onPageChange
  ])

  // Update configuration when props change
  React.useEffect(() => {
    if (!isInitialized) return

    const config: Partial<PaginationConfig> = {
      pageWidth,
      pageHeight,
      fontSize,
      fontFamily,
      lineHeight,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      chapterTitle,
      chapterTitleFontSize,
      chapterTitlePadding,
      showChapterTitle,
    }

    autoPagination.updateConfig(config)
  }, [
    isInitialized, pageWidth, pageHeight, fontSize, fontFamily, lineHeight,
    marginTop, marginBottom, marginLeft, marginRight,
    chapterTitle, chapterTitleFontSize, chapterTitlePadding, showChapterTitle
  ])

  // Update content when external content changes
  React.useEffect(() => {
    if (content !== localContent) {
      setLocalContent(content)
      if (isInitialized) {
        autoPagination.updateContent(content, false) // No debounce for external updates
      }
    }
  }, [content, localContent, isInitialized])

  // Handle content changes from user input
  const handleContentChange = React.useCallback((newContent: string) => {
    setLocalContent(newContent)
    
    if (isInitialized) {
      // Update pagination with debounce for performance
      autoPagination.updateContent(newContent, true)
    }
    
    // Notify parent immediately for local state management
    onContentChange?.(newContent)
  }, [isInitialized, onContentChange])

  // Handle page navigation
  const navigateToPage = React.useCallback((pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < paginationState.totalPages) {
      setCurrentPageIndex(pageIndex)
    }
  }, [paginationState.totalPages])

  // Auto-navigate to page with cursor/new content
  React.useEffect(() => {
    if (paginationState.pages.length > 0) {
      // Find the last page with content
      const lastPageWithContent = paginationState.pages
        .map((page, index) => ({ page, index }))
        .filter(({ page }) => page.content.trim())
        .pop()

      if (lastPageWithContent) {
        setCurrentPageIndex(lastPageWithContent.index)
      }
    }
  }, [paginationState.pages])

  // Get current page data
  const currentPage = paginationState.pages[currentPageIndex]
  
  // If not initialized or no pages, show loading state
  if (!isInitialized || paginationState.pages.length === 0) {
    return (
      <Card className={cn(
        "relative overflow-hidden rounded-none shadow-lg border-none p-0",
        "bg-white dark:bg-card text-gray-900 dark:text-gray-200",
        "flex items-center justify-center",
        className
      )} style={{ width: `${pageWidth * 96}px`, height: `${pageHeight * 96}px` }}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RotateCcw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Preparing pages...</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Navigation Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {currentPageIndex + 1} of {paginationState.totalPages}
          {paginationState.isRecalculating && " (updating...)"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(currentPageIndex - 1)}
            disabled={currentPageIndex === 0}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(currentPageIndex + 1)}
            disabled={currentPageIndex >= paginationState.totalPages - 1}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Current Page */}
      <SinglePageView
        page={currentPage}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        fontSize={fontSize}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        marginTop={marginTop}
        marginBottom={marginBottom}
        marginLeft={marginLeft}
        marginRight={marginRight}
        chapterTitleFontFamily={chapterTitleFontFamily}
        chapterTitleFontSize={chapterTitleFontSize}
        chapterTitleAlignment={chapterTitleAlignment}
        chapterTitlePadding={chapterTitlePadding}
        showChapterTitle={showChapterTitle}
        allContent={localContent}
        onContentChange={handleContentChange}
        onPreviousPage={currentPageIndex > 0 ? () => navigateToPage(currentPageIndex - 1) : undefined}
        onNextPage={currentPageIndex < paginationState.totalPages - 1 ? () => navigateToPage(currentPageIndex + 1) : undefined}
        textareaRef={textareaRef}
        onTextareaFocus={onTextareaFocus}
        onTextareaBlur={onTextareaBlur}
        onCursorPositionChange={onCursorPositionChange}
        className={className}
      />

      {/* All Pages Overview (for debugging - can be removed) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="text-xs text-muted-foreground">
          <summary>Debug: All Pages ({paginationState.totalPages})</summary>
          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
            {paginationState.pages.map((page, index) => (
              <div key={page.id} className="p-2 border rounded text-xs">
                <div className="font-mono">
                  Page {index + 1}: {page.content.length} chars
                </div>
                <div className="truncate mt-1 opacity-70">
                  {page.content.slice(0, 100)}...
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// Single page component for rendering individual pages
interface SinglePageViewProps {
  page: any
  pageWidth: number
  pageHeight: number
  fontSize: number
  fontFamily: string
  lineHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  chapterTitleFontFamily?: string
  chapterTitleFontSize: number
  chapterTitleAlignment: 'left' | 'center' | 'right'
  chapterTitlePadding: number
  showChapterTitle: boolean
  allContent: string
  onContentChange: (content: string) => void
  onPreviousPage?: () => void
  onNextPage?: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onTextareaFocus?: () => void
  onTextareaBlur?: () => void
  onCursorPositionChange?: () => void
  className?: string
}

function SinglePageView({
  page,
  pageWidth,
  pageHeight,
  fontSize,
  fontFamily,
  lineHeight,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  chapterTitleFontFamily,
  chapterTitleFontSize,
  chapterTitleAlignment,
  chapterTitlePadding,
  showChapterTitle,
  allContent,
  onContentChange,
  onPreviousPage,
  onNextPage,
  textareaRef,
  onTextareaFocus,
  onTextareaBlur,
  onCursorPositionChange,
  className,
}: SinglePageViewProps) {
  const DPI = 96
  const pageWidthPx = pageWidth * DPI
  const pageHeightPx = pageHeight * DPI
  const marginTopPx = marginTop * DPI
  const marginBottomPx = marginBottom * DPI
  const marginLeftPx = marginLeft * DPI
  const marginRightPx = marginRight * DPI

  const pageStyle: React.CSSProperties = {
    width: `${pageWidthPx}px`,
    height: `${pageHeightPx}px`,
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily,
    lineHeight: lineHeight,
    position: 'relative',
  }

  const textAreaStyle: React.CSSProperties = {
    width: `${pageWidthPx - marginLeftPx - marginRightPx}px`,
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily,
    lineHeight: lineHeight,
    marginLeft: `${marginLeftPx}px`,
    marginRight: `${marginRightPx}px`,
    border: 'none',
    outline: 'none',
    resize: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    textRendering: 'optimizeLegibility',
    whiteSpace: 'pre-wrap',
    boxShadow: 'none',
    borderRadius: '0',
    verticalAlign: 'top',
    textAlign: 'left',
  }

  return (
    <Card 
      className={cn(
        "relative overflow-hidden rounded-none shadow-lg border-none p-0",
        "bg-white dark:bg-card text-gray-900 dark:text-gray-200",
        className
      )}
      style={pageStyle}
    >
      {/* Corner Navigation Buttons */}
      {onPreviousPage && (
        <button
          onClick={onPreviousPage}
          className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white dark:bg-gray-700/80 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center transition-all hover:scale-105"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}
      
      {onNextPage && (
        <button
          onClick={onNextPage}
          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white dark:bg-gray-700/80 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center transition-all hover:scale-105"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      {/* Chapter title (only on first page of chapter) */}
      {showChapterTitle && page?.isFirstPageOfChapter && page?.chapterTitle && page.chapterTitle.trim() && (
        <div 
          className="absolute top-0 left-0 right-0 z-5 text-gray-800 dark:text-gray-300"
          style={{
            fontFamily: chapterTitleFontFamily || fontFamily,
            fontSize: `${chapterTitleFontSize}px`,
            textAlign: chapterTitleAlignment,
            fontWeight: 'bold',
            marginTop: `${marginTopPx}px`,
            marginLeft: `${marginLeftPx}px`,
            marginRight: `${marginRightPx}px`,
            paddingBottom: `${chapterTitlePadding}px`,
          }}
        >
          {page.chapterTitle}
        </div>
      )}

      {/* Page content - use full content, not just page content */}
      <Textarea
        ref={textareaRef}
        key={`page-${page?.pageNumber}-auto`}
        value={allContent}
        onChange={(e) => onContentChange(e.target.value)}
        onFocus={onTextareaFocus}
        onBlur={onTextareaBlur}
        onSelect={onCursorPositionChange}
        onKeyUp={onCursorPositionChange}
        onClick={onCursorPositionChange}
        placeholder={
          page?.isFirstPageOfChapter && showChapterTitle && page?.chapterTitle?.trim() 
            ? "Start writing your chapter..." 
            : "Continue your story..."
        }
        className="absolute bg-transparent border-none resize-none focus:ring-0 focus:border-none focus:outline-none overflow-hidden [&:focus]:border-none [&:focus]:outline-none [&:focus]:ring-0 cursor-text text-gray-900 dark:text-gray-300 placeholder:text-gray-500 dark:placeholder:text-gray-400"
        style={{
          ...textAreaStyle,
          top: showChapterTitle && page?.isFirstPageOfChapter && page?.chapterTitle?.trim() 
            ? `${marginTopPx + chapterTitleFontSize + chapterTitlePadding}px` 
            : `${marginTopPx}px`,
          height: showChapterTitle && page?.isFirstPageOfChapter && page?.chapterTitle?.trim()
            ? `${pageHeightPx - marginTopPx - marginBottomPx - chapterTitleFontSize - chapterTitlePadding}px`
            : `${pageHeightPx - marginTopPx - marginBottomPx}px`,
          pointerEvents: 'auto',
          zIndex: 10
        }}
      />

      {/* Page number */}
      <div 
        className="absolute text-gray-500 dark:text-gray-400 text-xs"
        style={{
          fontFamily: fontFamily,
          bottom: `${marginBottomPx / 2}px`,
          right: '50%',
          transform: 'translateX(50%)'
        }}
      >
        {page?.pageNumber || 1}
      </div>
    </Card>
  )
}
