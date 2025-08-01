import { prisma } from "@/lib/db"
import type { BrainstormingNote } from "@prisma/client"

export class BrainstormingService {
  static async getNotesByBookId(bookId: string): Promise<BrainstormingNote[]> {
    return await prisma.brainstormingNote.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async getRecentNotes(bookId: string, limit: number = 10): Promise<BrainstormingNote[]> {
    return await prisma.brainstormingNote.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }

  static async createNote(data: {
    title: string
    content: string
    tags?: string[]
    bookId: string
  }): Promise<BrainstormingNote> {
    return await prisma.brainstormingNote.create({
      data
    })
  }

  static async updateNote(id: string, data: {
    title?: string
    content?: string
    tags?: string[]
  }): Promise<BrainstormingNote> {
    return await prisma.brainstormingNote.update({
      where: { id },
      data
    })
  }

  static async deleteNote(id: string): Promise<BrainstormingNote> {
    return await prisma.brainstormingNote.delete({
      where: { id }
    })
  }

  static async searchNotes(bookId: string, query: string): Promise<BrainstormingNote[]> {
    return await prisma.brainstormingNote.findMany({
      where: {
        bookId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })
  }
} 