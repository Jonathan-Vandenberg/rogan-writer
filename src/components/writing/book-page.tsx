"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface BookPageProps {
  content?: string
  pageNumber?: number
  pageWidth?: number
  pageHeight?: number
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  wordsPerLine?: number
  linesPerPage?: number
  isEditable?: boolean
  showPageNumber?: boolean
  className?: string
  onContentChange?: (content: string) => void
  // Chapter title props
  chapterTitle?: string
  showChapterTitle?: boolean
  chapterTitleFontFamily?: string
  chapterTitleFontSize?: number
  chapterTitleAlignment?: 'left' | 'center' | 'right'
  chapterTitlePadding?: number
  isFirstPageOfChapter?: boolean
  // Page navigation
  onPreviousPage?: () => void
  onNextPage?: () => void
  // Speech-to-text support
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onTextareaFocus?: () => void
  onTextareaBlur?: () => void
  onCursorPositionChange?: () => void
}

// Single page component
function SinglePage({
  content,
  pageNumber,
  pageWidth,
  pageHeight,
  fontSize,
  fontFamily,
  lineHeight,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  isEditable,
  showPageNumber,
  onContentChange,
  chapterTitle,
  showChapterTitle,
  chapterTitleFontFamily,
  chapterTitleFontSize,
  chapterTitleAlignment,
  chapterTitlePadding,
  isFirstPageOfChapter,
  className,
  onPreviousPage,
  onNextPage,
  textareaRef,
  onTextareaFocus,
  onTextareaBlur,
  onCursorPositionChange,
}: BookPageProps) {
  const DPI = 96
  const pageWidthPx = pageWidth! * DPI
  const pageHeightPx = pageHeight! * DPI
  const marginTopPx = marginTop! * DPI
  const marginBottomPx = marginBottom! * DPI
  const marginLeftPx = marginLeft! * DPI
  const marginRightPx = marginRight! * DPI

  const pageStyle: React.CSSProperties = {
    width: `${pageWidthPx}px`,
    height: `${pageHeightPx}px`,
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily,
    lineHeight: lineHeight,
    backgroundColor: '#fefefe',
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
    color: '#1a1a1a',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    textRendering: 'optimizeLegibility',
    whiteSpace: 'pre-wrap',
    boxShadow: 'none',
    borderRadius: '0',
    // Normalize font metrics across different fonts
    verticalAlign: 'top',
    textAlign: 'left',
  }

  const getPageShadow = () => {
    return "shadow-lg"
  }

  return (
    <Card 
      className={cn(
        "relative overflow-hidden rounded-none",
        getPageShadow(),
        className
      )}
      style={pageStyle}
    >
      {/* Invisible clickable areas for page turning */}
      {onPreviousPage && (
        <div 
          className="absolute top-0 left-0 w-16 h-16 cursor-pointer z-10 hover:bg-black/10 hover:bg-opacity-5 transition-colors flex items-center justify-center"
          onClick={onPreviousPage}
          title="Previous page"
        >
          <ChevronLeft className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
      )}
      {onNextPage && (
        <div 
          className="absolute top-0 right-0 w-16 h-16 cursor-pointer z-10 hover:bg-black/10 hover:bg-opacity-5 transition-colors flex items-center justify-center"
          onClick={onNextPage}
          title="Next page"
        >
          <ChevronRight className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
      )}

      {/* Chapter title (only on first page of chapter) */}
      {showChapterTitle && isFirstPageOfChapter && chapterTitle && chapterTitle.trim() && (
        <div 
          className="absolute top-0 left-0 right-0 z-5"
          style={{
            fontFamily: chapterTitleFontFamily || fontFamily,
            fontSize: `${chapterTitleFontSize || 26}px`,
            textAlign: chapterTitleAlignment || 'center',
            fontWeight: 'bold',
            color: '#2d3748',
            marginTop: `${marginTopPx}px`,
            marginLeft: `${marginLeftPx}px`,
            marginRight: `${marginRightPx}px`,
            paddingBottom: `${chapterTitlePadding || 65}px`,
          }}
        >
          {chapterTitle}
        </div>
      )}

      {/* Page content */}
      <Textarea
        ref={textareaRef}
        key={`page-${pageNumber}-single`}
        value={content}
        onChange={(e) => onContentChange?.(e.target.value)}
        onFocus={onTextareaFocus}
        onBlur={onTextareaBlur}
        onSelect={onCursorPositionChange}
        onKeyUp={onCursorPositionChange}
        onClick={onCursorPositionChange}
        placeholder={isFirstPageOfChapter && showChapterTitle && chapterTitle && chapterTitle.trim() ? "Start writing your chapter..." : "Continue your story..."}
        className="absolute bg-transparent border-none resize-none focus:ring-0 focus:border-none focus:outline-none overflow-hidden [&:focus]:border-none [&:focus]:outline-none [&:focus]:ring-0"
        style={{
          ...textAreaStyle,
          top: showChapterTitle && isFirstPageOfChapter && chapterTitle && chapterTitle.trim() 
            ? `${marginTopPx + (chapterTitleFontSize || 26) + (chapterTitlePadding || 65)}px` 
            : `${marginTopPx}px`,
          height: showChapterTitle && isFirstPageOfChapter && chapterTitle && chapterTitle.trim()
            ? `${pageHeightPx - marginTopPx - marginBottomPx - (chapterTitleFontSize || 26) - (chapterTitlePadding || 65)}px`
            : `${pageHeightPx - marginTopPx - marginBottomPx}px`
        }}
        readOnly={!isEditable}
      />

        {/* Page number */}
        {showPageNumber && (
          <div 
            className="absolute text-gray-500 text-xs"
            style={{
              // fontSize: `${fontSize! * 0.9}px`,
              fontFamily: fontFamily,
              bottom: `${marginBottomPx / 2}px`,
              right: '50%',
              transform: 'translateX(50%)'
            }}
          >
            {pageNumber}
          </div>
        )}
      </Card>
    )
  }

  export function BookPage({
    content = "",
    pageNumber = 1,
    pageWidth = 6,
    pageHeight = 9,
    fontSize = 12,
    fontFamily = "Verdana",
    lineHeight = 1.5,
    marginTop = 1,
    marginBottom = 1,
    marginLeft = 0.6,
    marginRight = 0.7,
    isEditable = true,
    showPageNumber = true,
    className,
    onContentChange,
    chapterTitle,
    showChapterTitle,
    chapterTitleFontFamily,
    chapterTitleFontSize,
    chapterTitleAlignment,
    chapterTitlePadding,
    isFirstPageOfChapter,
    // Page navigation
    onPreviousPage,
    onNextPage,
    // Speech-to-text support
    textareaRef,
    onTextareaFocus,
    onTextareaBlur,
    onCursorPositionChange,
  }: BookPageProps) {
    // Single page view only
    return (
      <SinglePage
        content={content}
        pageNumber={pageNumber}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        fontSize={fontSize}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        marginTop={marginTop}
        marginBottom={marginBottom}
        marginLeft={marginLeft}
        marginRight={marginRight}
        isEditable={isEditable}
        showPageNumber={showPageNumber}
        onContentChange={onContentChange}
        chapterTitle={chapterTitle}
        showChapterTitle={showChapterTitle}
        chapterTitleFontFamily={chapterTitleFontFamily}
        chapterTitleFontSize={chapterTitleFontSize}
        chapterTitleAlignment={chapterTitleAlignment}
        chapterTitlePadding={chapterTitlePadding}
        isFirstPageOfChapter={isFirstPageOfChapter}
        className={className}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        textareaRef={textareaRef}
        onTextareaFocus={onTextareaFocus}
        onTextareaBlur={onTextareaBlur}
        onCursorPositionChange={onCursorPositionChange}
      />
    )
  }