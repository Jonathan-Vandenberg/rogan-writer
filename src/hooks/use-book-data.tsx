"use client"

import * as React from "react"
import { useSession } from "next-auth/react"

interface Chapter {
  id: string
  title: string
  description?: string
  content: string
  orderIndex: number
  wordCount: number
}

interface PageData {
  pageNumber: number
  content: string
  wordCount: number
  startPosition: number
  endPosition: number
}

interface Book {
  id: string
  title: string
  description?: string
  genre?: string
  targetWords?: number
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
  coverImageUrl?: string
  chapters: Chapter[]
}

interface UseBookDataReturn {
  // Data
  book: Book | null
  currentChapter: Chapter | null
  currentPageData: PageData | null
  paginationData: { totalPages: number; pageBreaks: number[]; pages: PageData[] }
  totalPages: number
  isLoading: boolean
  error: string | null
  
  // Actions
  loadBook: (bookId: string) => Promise<void>
  updateChapterContent: (chapterId: string, content: string) => Promise<void>
  updateChapterTitle: (chapterId: string, title: string) => Promise<void>
  createNewChapter: (bookId: string, title: string) => Promise<Chapter>
  
  // Navigation
  setCurrentChapter: (chapterId: string) => void
  setCurrentPage: (pageNumber: number) => void
  getCurrentChapterIndex: () => number
  getCurrentPageIndex: () => number
}

interface TypographySettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  pageWidth: number
  pageHeight: number
  marginTop: number
  marginLeft: number
  marginRight: number
  chapterTitleFontFamily: string
  chapterTitleFontSize: number
  chapterTitleAlignment: 'left' | 'center' | 'right'
  chapterTitlePadding: number
  showChapterTitle: boolean
}

export function useBookData(typographySettings?: TypographySettings): UseBookDataReturn {
  const { data: session } = useSession()
  const [book, setBook] = React.useState<Book | null>(null)
  const [currentChapterId, setCurrentChapterId] = React.useState<string | null>(null)
  const [currentPageNumber, setCurrentPageNumber] = React.useState<number>(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Get current chapter
  const currentChapter = book?.chapters.find(c => c.id === currentChapterId) || null

  // Calculate pagination for current chapter
  const paginationData = React.useMemo(() => {
    if (!currentChapter || !book) {
      return { totalPages: 1, pageBreaks: [0], pages: [] }
    }

    // Use typography settings if provided, otherwise fall back to book properties
    const settings = typographySettings || {
      fontFamily: book.fontFamily || "Verdana",
      fontSize: book.fontSize,
      lineHeight: book.lineHeight,
      pageWidth: book.pageWidth,
      pageHeight: book.pageHeight,
      marginTop: book.marginTop,
      marginLeft: book.marginLeft,
      marginRight: book.marginRight,
      chapterTitleFontFamily: book.fontFamily || "Verdana",
      chapterTitleFontSize: 26,
      chapterTitleAlignment: 'center' as const,
      chapterTitlePadding: 65,
      showChapterTitle: true,
    }

    // Calculate pagination based on typography settings
    const DPI = 96
    const pageWidthPx = settings.pageWidth * DPI
    const pageHeightPx = settings.pageHeight * DPI
    const marginTopPx = settings.marginTop * DPI
    const marginBottomPx = 0 * DPI // Hardcoded bottom margin
    const marginLeftPx = settings.marginLeft * DPI
    const marginRightPx = settings.marginRight * DPI
    
    const contentWidth = pageWidthPx - marginLeftPx - marginRightPx
    
    // Calculate actual available height for text (matching BookPage textarea constraints)
    const showPageNumber = true // Assume page numbers are shown
    const pageNumberSpace = showPageNumber ? (marginBottomPx === 0 ? 20 : 30) : 0 // Minimal space when margin is 0
    
    // For first page with chapter title, account for title space (match BookPage exactly)
    const chapterTitleFontSize = settings.chapterTitleFontSize || settings.fontSize * 1.5
    const chapterTitlePadding = settings.chapterTitlePadding || 20
    const chapterTitleSpace = settings.showChapterTitle ? (chapterTitleFontSize + chapterTitlePadding) : 0 // Remove extra 30px to match BookPage fix
    
    // Calculate height for pages WITHOUT chapter title (most pages)
    // Use actual bottom margin setting - 0 means no padding above page number
    const regularPageHeight = pageHeightPx - marginTopPx - marginBottomPx - pageNumberSpace
    
    // Calculate height for first page WITH chapter title  
    const firstPageHeight = pageHeightPx - marginTopPx - marginBottomPx - chapterTitleSpace - pageNumberSpace
    
    const lineHeightPx = settings.fontSize * settings.lineHeight
    const regularLinesPerPage = Math.floor(regularPageHeight / lineHeightPx)
    const firstPageLinesPerPage = Math.floor(firstPageHeight / lineHeightPx)
    
    // Estimate characters per line for line-wrapping calculations
    // Different fonts have different character widths
    const fontWidthMultiplier = settings.fontFamily.includes('Times') ? 0.55 : 
                                settings.fontFamily.includes('Garamond') || settings.fontFamily.includes('Minion') ? 0.56 :
                                settings.fontFamily.includes('Verdana') ? 0.60 : 0.58
    const avgCharWidth = settings.fontSize * fontWidthMultiplier
    const charsPerLine = Math.floor(contentWidth / avgCharWidth)

    // Handle missing or empty content
    const chapterContent = currentChapter.content || ''
    
    if (!chapterContent.trim()) {
      return { 
        totalPages: 1, 
        pageBreaks: [0], 
        pages: [{ 
          pageNumber: 1, 
          content: '', 
          wordCount: 0, 
          startPosition: 0, 
          endPosition: 0
        }] 
      }
    }

    // Line-based pagination with word boundary protection
    const pageBreaks: number[] = []
    const pages: PageData[] = []
    let currentPos = 0
    let pageNumber = 1
    
    // Helper function to count lines a text block would take
    const countLinesForText = (text: string): number => {
      if (!text.trim()) return 0
      
      const lines = text.split('\n')
      let totalLines = 0
      
      for (const line of lines) {
        if (line.trim() === '') {
          totalLines += 1 // Empty line still takes one line
        } else {
          // Calculate how many visual lines this text line will wrap to
          const lineLength = line.length
          const wrappedLines = Math.ceil(lineLength / charsPerLine) || 1
          totalLines += wrappedLines
        }
      }
      
      return totalLines
    }
    
    while (currentPos < chapterContent.length || pageNumber === 1) {
      const maxLinesForPage = pageNumber === 1 ? firstPageLinesPerPage : regularLinesPerPage
      let endPos = currentPos
      let linesUsed = 0
      
      // Build content line by line until we reach the line limit
      while (endPos < chapterContent.length && linesUsed < maxLinesForPage) {
        // Find the next word boundary
        const nextSpace = chapterContent.indexOf(' ', endPos)
        const nextNewline = chapterContent.indexOf('\n', endPos)
        
        // Find the nearest boundary
        let nextBoundary = chapterContent.length
        if (nextSpace !== -1) nextBoundary = Math.min(nextBoundary, nextSpace)
        if (nextNewline !== -1) nextBoundary = Math.min(nextBoundary, nextNewline)
        
        // If no boundary found, take the rest of the content
        if (nextBoundary === chapterContent.length) {
          const remainingText = chapterContent.slice(currentPos, nextBoundary)
          const remainingLines = countLinesForText(remainingText)
          if (linesUsed + remainingLines <= maxLinesForPage) {
            endPos = nextBoundary
            linesUsed += remainingLines
          }
          break
        }
        
        // Test if adding this word/segment would exceed line limit
        const testText = chapterContent.slice(currentPos, nextBoundary + 1)
        const testLines = countLinesForText(testText)
        
        if (testLines <= maxLinesForPage) {
          endPos = nextBoundary + 1
          linesUsed = testLines
        } else {
          // Adding this word would exceed the limit, stop here
          break
        }
      }
      
      // Ensure we don't go backwards
      if (endPos <= currentPos) {
        endPos = Math.min(currentPos + 1, chapterContent.length)
      }
      
      // Get page content
      const pageContent = currentPos >= chapterContent.length ? '' : chapterContent.slice(currentPos, endPos)
      const wordCount = pageContent.trim() ? pageContent.trim().split(/\s+/).length : 0

      pageBreaks.push(currentPos)
      pages.push({
        pageNumber: pageNumber,
        content: pageContent,
        wordCount,
        startPosition: currentPos,
        endPosition: currentPos >= chapterContent.length ? chapterContent.length : endPos
      })
      
      currentPos = endPos
      pageNumber++
      
      // Break if we've processed all content and have at least one page
      if (currentPos >= chapterContent.length && pageNumber > 1) {
        break
      }
    }
    
    // Return pages as they are - content flows naturally
    const totalPages = pages.length
    
    return { totalPages, pageBreaks, pages }
  }, [currentChapter, book, typographySettings])

  // Get current page data
  const currentPageData = paginationData.pages.find(p => p.pageNumber === currentPageNumber) || null
  const totalPages = paginationData.totalPages

  // Load book data with chapters
  const loadBook = React.useCallback(async (bookId: string) => {
    if (!session?.user?.id) return

    setIsLoading(true)
    setError(null)

    try {
      // Load chapters
      const chaptersResponse = await fetch(`/api/books/${bookId}/chapters`)
      if (!chaptersResponse.ok) throw new Error('Failed to load chapters')
      const chapters = await chaptersResponse.json()

      console.log('bookid:', bookId)
      // Load book details
      const bookResponse = await fetch(`/api/books/${bookId}`)
      console.log('bookResponse', bookResponse)
      if (!bookResponse.ok) throw new Error('Failed to load book')
      const bookData = await bookResponse.json()

      const bookWithChapters: Book = {
        ...bookData,
        chapters: chapters.sort((a: any, b: any) => a.orderIndex - b.orderIndex)
      }

      setBook(bookWithChapters)

      // Set current chapter to first one if they exist
      if (bookWithChapters.chapters.length > 0) {
        const firstChapter = bookWithChapters.chapters[0]
        setCurrentChapterId(firstChapter.id)
        setCurrentPageNumber(1)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load book')
      console.error('Error loading book:', err)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  // Update chapter content
  const updateChapterContent = React.useCallback(async (chapterId: string, content: string) => {
    if (!session?.user?.id) return

    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) throw new Error('Failed to save chapter')

      const updatedChapter = await response.json()

      // Update local state
      setBook(prevBook => {
        if (!prevBook) return prevBook

        return {
          ...prevBook,
          chapters: prevBook.chapters.map(chapter => 
            chapter.id === chapterId 
              ? { ...chapter, content: updatedChapter.content, wordCount: updatedChapter.wordCount }
              : chapter
          )
        }
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save chapter')
      console.error('Error saving chapter:', err)
    }
  }, [session?.user?.id])

  // Create new chapter
  const createNewChapter = React.useCallback(async (bookId: string, title: string): Promise<Chapter> => {
    if (!session?.user?.id) throw new Error('Not authenticated')

    const response = await fetch(`/api/books/${bookId}/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    })

    if (!response.ok) throw new Error('Failed to create chapter')

    const newChapter = await response.json()

    // Update local state
    setBook(prevBook => {
      if (!prevBook) return prevBook

      return {
        ...prevBook,
        chapters: [...prevBook.chapters, newChapter].sort((a, b) => a.orderIndex - b.orderIndex)
      }
    })

    return newChapter
  }, [session?.user?.id])

  // Update chapter title
  const updateChapterTitle = React.useCallback(async (chapterId: string, title: string) => {
    if (!session?.user?.id) return

    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) throw new Error('Failed to update chapter title')

      const updatedChapter = await response.json()

      // Update local state
      setBook(prevBook => {
        if (!prevBook) return prevBook

        return {
          ...prevBook,
          chapters: prevBook.chapters.map(chapter => 
            chapter.id === chapterId 
              ? { ...chapter, title: updatedChapter.title }
              : chapter
          )
        }
      })

    } catch (err) {
      console.error('Error updating chapter title:', err)
    }
  }, [session?.user?.id])

  // Navigation helpers
  const setCurrentChapter = React.useCallback((chapterId: string) => {
    setCurrentChapterId(chapterId)
    setCurrentPageNumber(1) // Reset to first page when changing chapters
  }, [])

  const setCurrentPage = React.useCallback((pageNumber: number) => {
    setCurrentPageNumber(pageNumber)
  }, [])

  const getCurrentChapterIndex = React.useCallback(() => {
    if (!book || !currentChapterId) return 0
    return book.chapters.findIndex(c => c.id === currentChapterId) + 1
  }, [book, currentChapterId])

  const getCurrentPageIndex = React.useCallback(() => {
    return currentPageNumber
  }, [currentPageNumber])

  return {
    book,
    currentChapter,
    currentPageData,
    paginationData,
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
  }
} 