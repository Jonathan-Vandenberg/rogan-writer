import { prisma } from '@/lib/db'
import type { Chapter, Prisma } from '@prisma/client'

export class ChapterService {
  static async getChaptersByBookId(bookId: string): Promise<Chapter[]> {
    return await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            sceneCards: true,
            plotPoints: true,
            comments: true
          }
        }
      }
    })
  }

  static async getChapterById(id: string): Promise<Chapter | null> {
    return await prisma.chapter.findUnique({
      where: { id },
      include: {
        book: true,
        sceneCards: {
          orderBy: { orderIndex: 'asc' }
        },
        plotPoints: {
          orderBy: { orderIndex: 'asc' }
        },
        comments: {
          include: {
            collaborator: true
          }
        }
      }
    })
  }

  static async createChapter(data: {
    title: string
    description?: string
    bookId: string
    content?: string
  }): Promise<Chapter> {
    // Get the next order index
    const lastChapter = await prisma.chapter.findFirst({
      where: { bookId: data.bookId },
      orderBy: { orderIndex: 'desc' }
    })
    
    const orderIndex = lastChapter ? lastChapter.orderIndex + 1 : 0
    const content = data.content || ''
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

    return await prisma.chapter.create({
      data: {
        ...data,
        content,
        orderIndex,
        wordCount
      }
    })
  }

  static async updateChapter(
    id: string, 
    data: Partial<Pick<Chapter, 'title' | 'description' | 'orderIndex' | 'content'>>
  ): Promise<Chapter> {
    // Calculate word count if content is being updated
    const updateData: any = { ...data }
    if (data.content !== undefined) {
      updateData.wordCount = data.content.trim() ? data.content.trim().split(/\s+/).length : 0
    }

    return await prisma.chapter.update({
      where: { id },
      data: updateData
    })
  }

  static async updateChapterContent(id: string, content: string): Promise<Chapter> {
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
    
    return await prisma.chapter.update({
      where: { id },
      data: {
        content,
        wordCount,
        updatedAt: new Date()
      }
    })
  }

  static async deleteChapter(id: string): Promise<Chapter> {
    return await prisma.chapter.delete({
      where: { id }
    })
  }

  static async reorderChapters(bookId: string, chapterIds: string[]): Promise<void> {
    // Update chapters with new order
    const updates = chapterIds.map((chapterId, index) =>
      prisma.chapter.update({
        where: { id: chapterId },
        data: { orderIndex: index }
      })
    )

    await prisma.$transaction(updates)
  }

  static async updateWordCount(id: string): Promise<Chapter> {
    // Calculate word count from chapter content
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: { content: true }
    })

    if (!chapter) {
      throw new Error('Chapter not found')
    }

    const wordCount = chapter.content.trim() ? chapter.content.trim().split(/\s+/).length : 0

    return await prisma.chapter.update({
      where: { id },
      data: { wordCount }
    })
  }

  static async getChapterStats(id: string) {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sceneCards: true,
            plotPoints: true,
            comments: true
          }
        }
      }
    })

    if (!chapter) return null

    return {
      ...chapter,
      stats: {
        wordCount: chapter.wordCount,
        sceneCardsCount: chapter._count.sceneCards,
        plotPointsCount: chapter._count.plotPoints,
        commentsCount: chapter._count.comments,
        characterCount: chapter.content.length,
        paragraphs: chapter.content.split('\n\n').filter(p => p.trim()).length
      }
    }
  }

  // New method to calculate dynamic pagination
  static calculatePagination(content: string, typography: {
    fontSize: number
    lineHeight: number
    pageWidth: number
    pageHeight: number
    marginTop: number
    marginBottom: number
    marginLeft: number
    marginRight: number
    fontFamily: string
  }): { totalPages: number; pageBreaks: number[] } {
    // This is a simplified pagination calculation
    // In a real implementation, you'd want more sophisticated text measurement
    
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
    
    // Estimate characters per line (rough calculation)
    const avgCharWidth = typography.fontSize * 0.6
    const charsPerLine = Math.floor(contentWidth / avgCharWidth)
    
    const charsPerPage = linesPerPage * charsPerLine
    
    if (!content.trim()) {
      return { totalPages: 1, pageBreaks: [0] }
    }
    
    const totalPages = Math.max(1, Math.ceil(content.length / charsPerPage))
    const pageBreaks: number[] = []
    
    for (let i = 0; i < totalPages; i++) {
      pageBreaks.push(i * charsPerPage)
    }
    
    return { totalPages, pageBreaks }
  }

  static getPageContent(content: string, pageNumber: number, pageBreaks: number[]): string {
    if (pageNumber < 1 || pageNumber > pageBreaks.length) {
      return ''
    }
    
    const startPos = pageBreaks[pageNumber - 1]
    const endPos = pageNumber < pageBreaks.length ? pageBreaks[pageNumber] : content.length
    
    return content.slice(startPos, endPos)
  }
} 