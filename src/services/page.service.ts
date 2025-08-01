import { prisma } from '@/lib/db'
import type { Page, Prisma } from '@prisma/client'

export class PageService {
  // Since pages are now just metadata (startPosition, endPosition), 
  // most page operations should go through ChapterService instead
  
  static async getPagesByChapterId(chapterId: string): Promise<Page[]> {
    return await prisma.page.findMany({
      where: { chapterId },
      orderBy: { pageNumber: 'asc' },
      include: {
        comments: {
          include: {
            collaborator: true
          }
        }
      }
    })
  }

  static async getPageById(id: string): Promise<Page | null> {
    return await prisma.page.findUnique({
      where: { id },
      include: {
        chapter: {
          include: {
            book: true
          }
        },
        comments: {
          include: {
            collaborator: true
          }
        }
      }
    })
  }

  static async getPageByNumber(chapterId: string, pageNumber: number): Promise<Page | null> {
    return await prisma.page.findUnique({
      where: {
        chapterId_pageNumber: {
          chapterId,
          pageNumber
        }
      },
      include: {
        chapter: true,
        comments: {
          include: {
            collaborator: true
          }
        }
      }
    })
  }

  static async createPage(data: {
    chapterId: string
  }): Promise<Page> {
    // Get the next page number
    const lastPage = await prisma.page.findFirst({
      where: { chapterId: data.chapterId },
      orderBy: { pageNumber: 'desc' }
    })
    
    const pageNumber = lastPage ? lastPage.pageNumber + 1 : 1

    return await prisma.page.create({
      data: {
        chapterId: data.chapterId,
        pageNumber,
        startPosition: 0, // Will be calculated dynamically
        endPosition: 0,   // Will be calculated dynamically
        wordCount: 0      // Will be calculated dynamically
      }
    })
  }

  static async updatePage(id: string, data: {
    startPosition?: number
    endPosition?: number
    wordCount?: number
  }): Promise<Page> {
    return await prisma.page.update({
      where: { id },
      data
    })
  }

  static async deletePage(id: string): Promise<Page> {
    return await prisma.page.delete({
      where: { id }
    })
  }

  static async getPageStats(id: string) {
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            content: true
          }
        },
        _count: {
          select: {
            comments: true
          }
        }
      }
    })

    if (!page || !page.chapter) return null

    // Extract the page content from the chapter content
    const pageContent = page.chapter.content.slice(page.startPosition, page.endPosition)

    return {
      ...page,
      content: pageContent, // Virtual field for backward compatibility
      stats: {
        wordCount: page.wordCount,
        characterCount: pageContent.length,
        characterCountNoSpaces: pageContent.replace(/\s/g, '').length,
        commentsCount: page._count.comments,
        readingTimeMinutes: Math.ceil(page.wordCount / 200) // Average reading speed
      }
    }
  }

  // Helper method to calculate pagination from chapter content
  static calculatePaginationForChapter(
    chapterContent: string, 
    typography: {
      fontSize: number
      lineHeight: number
      pageWidth: number
      pageHeight: number
      marginTop: number
      marginBottom: number
      marginLeft: number
      marginRight: number
    }
  ): Array<{ pageNumber: number; startPosition: number; endPosition: number; wordCount: number }> {
    // This is a simplified pagination calculation
    const DPI = 96
    const pageWidthPx = typography.pageWidth * DPI
    const pageHeightPx = typography.pageHeight * DPI
    const marginTopPx = typography.marginTop * DPI
    const marginBottomPx = typography.marginBottom * DPI
    const marginLeftPx = typography.marginLeft * DPI
    const marginRightPx = typography.marginRight * DPI
    
    const contentWidth = pageWidthPx - marginLeftPx - marginRightPx
    const contentHeight = pageHeightPx - marginTopPx - marginBottomPx
    
    const lineHeightPx = typography.fontSize * typography.lineHeight
    const linesPerPage = Math.floor(contentHeight / lineHeightPx)
    
    // Estimate characters per line
    const avgCharWidth = typography.fontSize * 0.6
    const charsPerLine = Math.floor(contentWidth / avgCharWidth)
    const charsPerPage = linesPerPage * charsPerLine
    
    if (!chapterContent.trim()) {
      return [{
        pageNumber: 1,
        startPosition: 0,
        endPosition: 0,
        wordCount: 0
      }]
    }
    
    const pages: Array<{ pageNumber: number; startPosition: number; endPosition: number; wordCount: number }> = []
    const totalChars = chapterContent.length
    let currentPos = 0
    let pageNumber = 1
    
    while (currentPos < totalChars) {
      const endPos = Math.min(currentPos + charsPerPage, totalChars)
      const pageContent = chapterContent.slice(currentPos, endPos)
      const wordCount = pageContent.trim() ? pageContent.trim().split(/\s+/).length : 0
      
      pages.push({
        pageNumber,
        startPosition: currentPos,
        endPosition: endPos,
        wordCount
      })
      
      currentPos = endPos
      pageNumber++
    }
    
    return pages
  }
} 