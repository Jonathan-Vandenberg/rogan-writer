import { prisma } from '@/lib/db'
import type { BookVersion, Book } from '@prisma/client'

export class BookVersionService {
  static async getVersionsByBookId(bookId: string): Promise<BookVersion[]> {
    return await prisma.bookVersion.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async getVersionById(id: string): Promise<BookVersion | null> {
    return await prisma.bookVersion.findUnique({
      where: { id },
      include: {
        book: true
      }
    })
  }

  static async createVersion(data: {
    version: string
    description?: string
    bookId: string
    snapshot: any // The complete book data snapshot
  }): Promise<BookVersion> {
    return await prisma.bookVersion.create({
      data: {
        ...data,
        snapshot: data.snapshot
      }
    })
  }

  static async deleteVersion(id: string): Promise<BookVersion> {
    return await prisma.bookVersion.delete({
      where: { id }
    })
  }

  static async getLatestVersion(bookId: string): Promise<BookVersion | null> {
    return await prisma.bookVersion.findFirst({
      where: { bookId },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async createBookSnapshot(bookId: string, version?: string, description?: string): Promise<BookVersion> {
    // Get complete book data
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: {
          include: {
            pages: {
              orderBy: { pageNumber: 'asc' }
            }
          },
          orderBy: { orderIndex: 'asc' }
        },
        characters: true,
        locations: true,
        plotPoints: {
          orderBy: { orderIndex: 'asc' }
        },
        timelineEvents: {
          orderBy: { orderIndex: 'asc' }
        },
        sceneCards: {
          orderBy: { orderIndex: 'asc' }
        },
        brainstormingNotes: {
          orderBy: { createdAt: 'desc' }
        },
        researchItems: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!book) {
      throw new Error('Book not found')
    }

    // Generate version number if not provided
    if (!version) {
      const latestVersion = await this.getLatestVersion(bookId)
      if (latestVersion) {
        const [major, minor] = latestVersion.version.split('.').map(Number)
        version = `${major}.${minor + 1}`
      } else {
        version = '1.0'
      }
    }

    return await this.createVersion({
      version,
      description,
      bookId,
      snapshot: book
    })
  }

  static async restoreFromVersion(versionId: string): Promise<Book> {
    const version = await this.getVersionById(versionId)
    
    if (!version) {
      throw new Error('Version not found')
    }

    const snapshot = version.snapshot as any
    const bookId = version.bookId

    // This is a complex operation that would need to:
    // 1. Delete current book data
    // 2. Restore from snapshot
    // For now, we'll just return the current book
    // TODO: Implement full restoration logic
    
    return await prisma.book.findUniqueOrThrow({
      where: { id: bookId }
    })
  }

  static async compareVersions(versionId1: string, versionId2: string) {
    const [version1, version2] = await Promise.all([
      this.getVersionById(versionId1),
      this.getVersionById(versionId2)
    ])

    if (!version1 || !version2) {
      throw new Error('One or both versions not found')
    }

    // Basic comparison - in a real implementation, this would be much more sophisticated
    const snapshot1 = version1.snapshot as any
    const snapshot2 = version2.snapshot as any

    return {
      version1: {
        version: version1.version,
        createdAt: version1.createdAt,
        wordCount: this.calculateWordCount(snapshot1),
        chaptersCount: snapshot1.chapters?.length || 0
      },
      version2: {
        version: version2.version,
        createdAt: version2.createdAt,
        wordCount: this.calculateWordCount(snapshot2),
        chaptersCount: snapshot2.chapters?.length || 0
      }
    }
  }

  private static calculateWordCount(snapshot: any): number {
    if (!snapshot.chapters) return 0
    
    return snapshot.chapters.reduce((total: number, chapter: any) => {
      if (!chapter.pages) return total
      return total + chapter.pages.reduce((chapterTotal: number, page: any) => {
        return chapterTotal + (page.wordCount || 0)
      }, 0)
    }, 0)
  }

  static async getVersionStats(bookId: string) {
    const versions = await this.getVersionsByBookId(bookId)
    
    if (versions.length === 0) {
      return {
        totalVersions: 0,
        latestVersion: null,
        firstVersion: null
      }
    }

    const latest = versions[0]
    const first = versions[versions.length - 1]

    return {
      totalVersions: versions.length,
      latestVersion: {
        version: latest.version,
        createdAt: latest.createdAt,
        description: latest.description
      },
      firstVersion: {
        version: first.version,
        createdAt: first.createdAt,
        description: first.description
      }
    }
  }
} 