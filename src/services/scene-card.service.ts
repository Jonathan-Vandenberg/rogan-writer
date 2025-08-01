import { prisma } from '@/lib/db'
import type { SceneCard, SceneStatus } from '@prisma/client'

export class SceneCardService {
  static async getSceneCardsByBookId(bookId: string): Promise<SceneCard[]> {
    return await prisma.sceneCard.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
      include: {
        chapter: true
      }
    })
  }

  static async getSceneCardsByChapterId(chapterId: string): Promise<SceneCard[]> {
    return await prisma.sceneCard.findMany({
      where: { chapterId },
      orderBy: { orderIndex: 'asc' }
    })
  }

  static async getSceneCardById(id: string): Promise<SceneCard | null> {
    return await prisma.sceneCard.findUnique({
      where: { id },
      include: {
        book: true,
        chapter: true
      }
    })
  }

  static async createSceneCard(data: {
    title: string
    description?: string
    purpose?: string
    conflict?: string
    outcome?: string
    bookId: string
    chapterId?: string
  }): Promise<SceneCard> {
    // Get the next order index
    const lastCard = await prisma.sceneCard.findFirst({
      where: { bookId: data.bookId },
      orderBy: { orderIndex: 'desc' }
    })
    
    const orderIndex = lastCard ? lastCard.orderIndex + 1 : 0

    return await prisma.sceneCard.create({
      data: {
        ...data,
        orderIndex,
        status: 'PLANNED'
      },
      include: {
        chapter: true
      }
    })
  }

  static async updateSceneCard(
    id: string,
    data: Partial<Pick<SceneCard, 'title' | 'description' | 'purpose' | 'conflict' | 'outcome' | 'orderIndex' | 'wordCount' | 'status' | 'chapterId'>>
  ): Promise<SceneCard> {
    return await prisma.sceneCard.update({
      where: { id },
      data,
      include: {
        chapter: true
      }
    })
  }

  static async deleteSceneCard(id: string): Promise<SceneCard> {
    return await prisma.sceneCard.delete({
      where: { id }
    })
  }

  static async reorderSceneCards(bookId: string, cardIds: string[]): Promise<void> {
    const updates = cardIds.map((cardId, index) =>
      prisma.sceneCard.update({
        where: { id: cardId },
        data: { orderIndex: index }
      })
    )

    await prisma.$transaction(updates)
  }

  static async getSceneCardsByStatus(bookId: string, status: SceneStatus): Promise<SceneCard[]> {
    return await prisma.sceneCard.findMany({
      where: { 
        bookId,
        status 
      },
      orderBy: { orderIndex: 'asc' },
      include: {
        chapter: true
      }
    })
  }

  static async updateSceneCardStatus(id: string, status: SceneStatus): Promise<SceneCard> {
    return await prisma.sceneCard.update({
      where: { id },
      data: { status },
      include: {
        chapter: true
      }
    })
  }

  static async searchSceneCards(bookId: string, searchTerm: string): Promise<SceneCard[]> {
    return await prisma.sceneCard.findMany({
      where: {
        bookId,
        OR: [
          {
            title: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            purpose: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        ]
      },
      orderBy: { orderIndex: 'asc' },
      include: {
        chapter: true
      }
    })
  }

  static async getSceneCardStats(bookId: string) {
    const [total, planned, draft, revised, complete] = await Promise.all([
      prisma.sceneCard.count({ where: { bookId } }),
      prisma.sceneCard.count({ where: { bookId, status: 'PLANNED' } }),
      prisma.sceneCard.count({ where: { bookId, status: 'DRAFT' } }),
      prisma.sceneCard.count({ where: { bookId, status: 'REVISED' } }),
      prisma.sceneCard.count({ where: { bookId, status: 'COMPLETE' } })
    ])

    const totalWordCount = await prisma.sceneCard.aggregate({
      where: { bookId },
      _sum: { wordCount: true }
    })

    return {
      total,
      byStatus: {
        planned,
        draft,
        revised,
        complete
      },
      totalWordCount: totalWordCount._sum.wordCount || 0,
      completionPercentage: total > 0 ? Math.round((complete / total) * 100) : 0
    }
  }
} 