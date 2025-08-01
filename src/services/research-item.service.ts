import { prisma } from '@/lib/db'
import type { ResearchItem, ResearchType } from '@prisma/client'

export class ResearchItemService {
  static async getResearchItemsByBookId(bookId: string): Promise<ResearchItem[]> {
    return await prisma.researchItem.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async getResearchItemById(id: string): Promise<ResearchItem | null> {
    return await prisma.researchItem.findUnique({
      where: { id },
      include: {
        book: true
      }
    })
  }

  static async createResearchItem(data: {
    title: string
    content?: string
    url?: string
    imageUrl?: string
    tags?: string[]
    itemType?: ResearchType
    bookId: string
  }): Promise<ResearchItem> {
    return await prisma.researchItem.create({
      data: {
        ...data,
        itemType: data.itemType || 'NOTE',
        tags: data.tags || []
      }
    })
  }

  static async updateResearchItem(
    id: string,
    data: Partial<Pick<ResearchItem, 'title' | 'content' | 'url' | 'imageUrl' | 'tags' | 'itemType'>>
  ): Promise<ResearchItem> {
    return await prisma.researchItem.update({
      where: { id },
      data
    })
  }

  static async deleteResearchItem(id: string): Promise<ResearchItem> {
    return await prisma.researchItem.delete({
      where: { id }
    })
  }

  static async getResearchItemsByType(bookId: string, itemType: ResearchType): Promise<ResearchItem[]> {
    return await prisma.researchItem.findMany({
      where: { 
        bookId,
        itemType 
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async getResearchItemsByTag(bookId: string, tag: string): Promise<ResearchItem[]> {
    return await prisma.researchItem.findMany({
      where: {
        bookId,
        tags: {
          has: tag
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async searchResearchItems(bookId: string, searchTerm: string): Promise<ResearchItem[]> {
    return await prisma.researchItem.findMany({
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
            content: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            tags: {
              hasSome: [searchTerm]
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async getAllTags(bookId: string): Promise<string[]> {
    const items = await prisma.researchItem.findMany({
      where: { bookId },
      select: { tags: true }
    })

    const allTags = items.flatMap(item => item.tags)
    return [...new Set(allTags)].sort()
  }

  static async getResearchItemStats(bookId: string) {
    const [total, notes, links, images, documents, videos] = await Promise.all([
      prisma.researchItem.count({ where: { bookId } }),
      prisma.researchItem.count({ where: { bookId, itemType: 'NOTE' } }),
      prisma.researchItem.count({ where: { bookId, itemType: 'LINK' } }),
      prisma.researchItem.count({ where: { bookId, itemType: 'IMAGE' } }),
      prisma.researchItem.count({ where: { bookId, itemType: 'DOCUMENT' } }),
      prisma.researchItem.count({ where: { bookId, itemType: 'VIDEO' } })
    ])

    const allTags = await this.getAllTags(bookId)

    return {
      total,
      byType: {
        notes,
        links,
        images,
        documents,
        videos
      },
      totalTags: allTags.length,
      tags: allTags
    }
  }

  static async updateEmbedding(id: string, embedding: number[]): Promise<ResearchItem> {
    // TODO: Implement proper vector embedding update when AI features are ready
    // For now, just return the item without updating embedding
    return await prisma.researchItem.findUniqueOrThrow({
      where: { id }
    })
  }
} 