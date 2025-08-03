"use client"

import * as React from "react"
import { useParams, useSearchParams } from "next/navigation"
import { BookPage } from "@/components/writing/book-page"
import { PageNavigation } from "@/components/writing/page-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowLeft, BookOpen, Edit2, Eye, EyeOff, Settings } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BookData {
  id: string
  title: string
  description: string | null
  status: string
  pageWidth: number
  pageHeight: number
  fontSize: number
  fontFamily: string
  lineHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  chapters: Array<{
    id: string
    title: string
    content: string
    orderIndex: number
    wordCount: number
  }>
  _count: {
    chapters: number
    characters: number
    plotPoints: number
  }
}

interface PageData {
  id: string
  pageNumber: number
  startPosition: number
  endPosition: number
  wordCount: number
  chapterId: string
}

export default function ReadBookPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const bookId = params.bookId as string

  const [book, setBook] = React.useState<BookData | null>(null)
  const [pages, setPages] = React.useState<PageData[]>([])
  const [currentPageIndex, setCurrentPageIndex] = React.useState(0)
  const [showDoublePages, setShowDoublePages] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  // Fetch book data
  React.useEffect(() => {
    async function fetchBook() {
      if (!bookId) return
      
      try {
        setLoading(true)
        const response = await fetch(`/api/books/${bookId}`)
        if (response.ok) {
          const bookData = await response.json()
          setBook(bookData)
          
          // Generate pages from chapters
          generatePages(bookData)
        }
      } catch (error) {
        console.error('Error fetching book:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBook()
  }, [bookId])

  const generatePages = (bookData: BookData) => {
    // Simple page generation - split chapters into pages based on estimated words per page
    const WORDS_PER_PAGE = 250
    const pages: PageData[] = []
    let pageNumber = 1

    bookData.chapters.forEach((chapter) => {
      if (!chapter.content.trim()) {
        // Empty chapter gets one page
        pages.push({
          id: `page-${chapter.id}-1`,
          pageNumber: pageNumber++,
          startPosition: 0,
          endPosition: 0,
          wordCount: 0,
          chapterId: chapter.id
        })
        return
      }

      // Split content into paragraphs while preserving structure
      const paragraphs = chapter.content.split(/\n\s*\n/) // Split on double newlines (paragraph breaks)
      const allText = chapter.content.replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      const words = allText.split(/\s+/).filter(word => word.length > 0)
      const totalWords = words.length
      const numPages = Math.max(1, Math.ceil(totalWords / WORDS_PER_PAGE))

      for (let i = 0; i < numPages; i++) {
        const startWord = i * WORDS_PER_PAGE
        const endWord = Math.min(startWord + WORDS_PER_PAGE, totalWords)
        
        pages.push({
          id: `page-${chapter.id}-${i + 1}`,
          pageNumber: pageNumber++,
          startPosition: startWord,
          endPosition: endWord,
          wordCount: endWord - startWord,
          chapterId: chapter.id
        })
      }
    })

    setPages(pages)
  }

  const getCurrentChapter = (pageIndex: number) => {
    if (!book || !pages[pageIndex]) return null
    return book.chapters.find(ch => ch.id === pages[pageIndex].chapterId)
  }

  const getPageContent = (pageIndex: number) => {
    const page = pages[pageIndex]
    const chapter = getCurrentChapter(pageIndex)
    
    if (!page || !chapter) return ""
    
    if (page.startPosition === 0 && page.endPosition === 0) {
      return "" // Empty page
    }

    // Preserve original formatting including newlines
    const originalContent = chapter.content
    
    // Split by words while keeping track of original positions
    const words = []
    const wordPositions = []
    const currentPos = 0
    
    // Use a more sophisticated split that preserves structure
    const parts = originalContent.split(/(\s+)/)
    let wordIndex = 0
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part.trim()) { // This is a word
        words.push(part)
        wordPositions.push({ word: part, followedBy: parts[i + 1] || '' })
        wordIndex++
      }
    }
    
    // Get the words for this page
    const pageWords = words.slice(page.startPosition, page.endPosition)
    const pagePositions = wordPositions.slice(page.startPosition, page.endPosition)
    
    // Reconstruct content with original spacing and newlines
    let content = ''
    for (let i = 0; i < pageWords.length; i++) {
      content += pageWords[i]
      if (i < pageWords.length - 1) {
        const followedBy = pagePositions[i]?.followedBy || ' '
        content += followedBy
      }
    }
    
    return content
  }

  const isFirstPageOfChapter = (pageIndex: number) => {
    const page = pages[pageIndex]
    if (!page) return false
    
    // Check if this is the first page for this chapter
    const chapterPages = pages.filter(p => p.chapterId === page.chapterId)
    return chapterPages.length > 0 && chapterPages[0].id === page.id
  }

  const getChapterTitle = (pageIndex: number) => {
    const chapter = getCurrentChapter(pageIndex)
    return chapter?.title || ""
  }

  const getCurrentChapterIndex = (pageIndex: number) => {
    const page = pages[pageIndex]
    if (!page || !book) return 0
    
    const chapterIndex = book.chapters.findIndex(ch => ch.id === page.chapterId)
    return Math.max(0, chapterIndex)
  }

  const goToChapter = (chapterIndex: number) => {
    if (!book || chapterIndex < 0 || chapterIndex >= book.chapters.length) return
    
    const chapterId = book.chapters[chapterIndex].id
    const firstPageOfChapter = pages.findIndex(p => p.chapterId === chapterId)
    
    if (firstPageOfChapter !== -1) {
      setCurrentPageIndex(firstPageOfChapter)
    }
  }

  const addNewPage = () => {
    // In read mode, we don't allow adding pages
    console.log("Cannot add pages in read mode")
  }

  const addNewChapter = () => {
    // In read mode, we don't allow adding chapters
    console.log("Cannot add chapters in read mode")
  }

  const goToPreviousPage = () => {
    if (showDoublePages) {
      setCurrentPageIndex(Math.max(0, currentPageIndex - 2))
    } else {
      setCurrentPageIndex(Math.max(0, currentPageIndex - 1))
    }
  }

  const goToNextPage = () => {
    const maxIndex = pages.length - 1
    if (showDoublePages) {
      setCurrentPageIndex(Math.min(maxIndex - 1, currentPageIndex + 2))
    } else {
      setCurrentPageIndex(Math.min(maxIndex, currentPageIndex + 1))
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Book not found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{book.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {formatStatus(book.status)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {book._count.chapters} chapters • {pages.length} pages
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDoublePages(!showDoublePages)}
          >
            {showDoublePages ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showDoublePages ? 'Double Page' : 'Single Page'}
          </Button>
          <Link href={`/write?book=${bookId}`}>
            <Button size="sm">
              <Edit2 className="h-4 w-4 mr-2" />
              Write Mode
            </Button>
          </Link>
        </div>
      </div>

      {/* Reading Area */}
      <div>
          {pages.length > 0 ? (
            <div className="flex justify-center">
              <div className={cn(
                "flex gap-8 items-start",
                !showDoublePages && "justify-center"
              )}>
                {/* Left/Only Page */}
                <BookPage
                  content={getPageContent(currentPageIndex)}
                  pageNumber={pages[currentPageIndex]?.pageNumber || 1}
                  pageWidth={book.pageWidth || 6.0}
                  pageHeight={book.pageHeight || 9.0}
                  fontSize={book.fontSize || 12}
                  fontFamily={book.fontFamily || "Verdana"}
                  lineHeight={book.lineHeight || 1.5}
                  marginTop={book.marginTop || 0.7}
                  marginBottom={book.marginBottom || 0.7}
                  marginLeft={book.marginLeft || 1.0}
                  marginRight={book.marginRight || 1.0}
                  isEditable={false}
                  showPageNumber={true}
                  chapterTitle={getChapterTitle(currentPageIndex)}
                  showChapterTitle={true}
                  chapterTitleFontFamily={book.fontFamily || "Verdana"}
                  chapterTitleFontSize={26}
                  chapterTitleAlignment="center"
                  chapterTitlePadding={65}
                  isFirstPageOfChapter={isFirstPageOfChapter(currentPageIndex)}
                  onPreviousPage={currentPageIndex > 0 ? goToPreviousPage : undefined}
                  onNextPage={currentPageIndex < pages.length - 1 ? goToNextPage : undefined}
                />
                
                {/* Right Page (only in double page mode) */}
                {showDoublePages && currentPageIndex + 1 < pages.length && (
                  <BookPage
                    content={getPageContent(currentPageIndex + 1)}
                    pageNumber={pages[currentPageIndex + 1]?.pageNumber || 2}
                    pageWidth={book.pageWidth || 6.0}
                    pageHeight={book.pageHeight || 9.0}
                    fontSize={book.fontSize || 12}
                    fontFamily={book.fontFamily || "Verdana"}
                    lineHeight={book.lineHeight || 1.5}
                    marginTop={book.marginTop || 0.7}
                    marginBottom={book.marginBottom || 0.7}
                    marginLeft={book.marginLeft || 1.0}
                    marginRight={book.marginRight || 1.0}
                    isEditable={false}
                    showPageNumber={true}
                    chapterTitle={getChapterTitle(currentPageIndex + 1)}
                    showChapterTitle={true}
                    chapterTitleFontFamily={book.fontFamily || "Verdana"}
                    chapterTitleFontSize={26}
                    chapterTitleAlignment="center"
                    chapterTitlePadding={65}
                    isFirstPageOfChapter={isFirstPageOfChapter(currentPageIndex + 1)}
                    onPreviousPage={currentPageIndex > 0 ? goToPreviousPage : undefined}
                    onNextPage={currentPageIndex + 1 < pages.length - 1 ? goToNextPage : undefined}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No content yet</h3>
              <p className="text-muted-foreground mb-4">
                This book doesn't have any content to read yet.
              </p>
              <Link href={`/write?book=${bookId}`}>
                <Button>
                  Start Writing
                </Button>
              </Link>
            </div>
          )}
        </div>

      {/* Page Navigation */}
      {pages.length > 0 && (
        <div className="flex justify-center">
          <PageNavigation
            currentPage={pages[currentPageIndex]?.pageNumber || 1}
            totalPages={pages.length}
            currentChapter={getCurrentChapterIndex(currentPageIndex) + 1}
            totalChapters={book._count.chapters}
            chapterTitle={getChapterTitle(currentPageIndex)}
            onPageChange={(pageNum) => setCurrentPageIndex(pageNum - 1)}
            onChapterChange={(chapterNum) => goToChapter(chapterNum - 1)}
            onNewPage={addNewPage}
            onNewChapter={addNewChapter}
          />
        </div>
      )}
    </div>
  )
} 