import { prisma } from '@/lib/db'
import type { Book, Prisma } from '@prisma/client'
import { countWords } from '@/lib/word-utils'

export type BookWithDetails = Book & {
  author: { name: string | null; email: string } | null
  chapters: Array<{
    id: string
    title: string
    description: string | null
    content: string
    orderIndex: number
    wordCount: number
    createdAt: Date
    updatedAt: Date
    bookId: string
  }>
  _count: {
    chapters: number
    characters: number
    plotPoints: number
  }
}

export class BookService {
  static async getBooksByUserId(userId: string): Promise<Book[]> {
    return await prisma.book.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    })
  }

  static async getBookById(id: string): Promise<BookWithDetails | null> {
    return await prisma.book.findUnique({
      where: { id },
      include: {
        author: { select: { name: true, email: true } },
        chapters: {
          orderBy: { orderIndex: 'asc' }
        },
        _count: {
          select: {
            chapters: true,
            characters: true,
            plotPoints: true
          }
        }
      }
    })
  }

  static async createBook(data: {
    title: string
    description?: string
    genre?: string
    targetWords?: number
    userId: string
    pageWidth?: number
    pageHeight?: number
    fontSize?: number
    fontFamily?: string
    lineHeight?: number
    marginTop?: number
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
  }): Promise<Book> {
    // Create the book and its first chapter in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the book
      const book = await tx.book.create({
        data
      })

      // Create the first chapter
      await tx.chapter.create({
        data: {
          title: "Chapter 1",
          description: "The beginning of your story",
          content: "",
          orderIndex: 0,
          bookId: book.id,
          wordCount: 0
        }
      })

      return book
    })

    return result
  }

  static async updateBook(id: string, data: Partial<Book>): Promise<Book> {
    return await prisma.book.update({
      where: { id },
      data
    })
  }

  static async deleteBook(id: string): Promise<Book> {
    return await prisma.book.delete({
      where: { id }
    })
  }



  static async getBookStats(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        chapters: {
          select: {
            wordCount: true,
            content: true
          }
        },
        _count: {
          select: {
            chapters: true,
            characters: true,
            plotPoints: true
          }
        }
      }
    })

    if (!book) return null

    // Calculate total words from chapter word counts
    const totalWords = book.chapters.reduce((total, chapter) => total + chapter.wordCount, 0)
    
    // Calculate total pages by estimating from all chapter content
    const totalPages = book.chapters.reduce((total, chapter) => {
      if (!chapter.content.trim()) return total + 1 // Empty chapters have at least 1 page
      
      // Estimate pages based on content length (rough approximation)
      const avgWordsPerPage = 250 // Typical book page
      const chapterPages = Math.max(1, Math.ceil(chapter.wordCount / avgWordsPerPage))
      return total + chapterPages
    }, 0)

    return {
      ...book,
      stats: {
        totalWords,
        totalPages,
        totalChapters: book._count.chapters,
        totalCharacters: book._count.characters,
        totalPlotPoints: book._count.plotPoints,
        avgWordsPerChapter: book._count.chapters > 0 ? Math.round(totalWords / book._count.chapters) : 0
      }
    }
  }
} 