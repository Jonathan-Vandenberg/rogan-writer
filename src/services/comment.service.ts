import { prisma } from '@/lib/db'
import type { Comment } from '@prisma/client'

export class CommentService {
  static async getCommentsByPageId(pageId: string): Promise<Comment[]> {
    return await prisma.comment.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
      include: {
        collaborator: true
      }
    })
  }

  static async getCommentsByChapterId(chapterId: string): Promise<Comment[]> {
    return await prisma.comment.findMany({
      where: { chapterId },
      orderBy: { createdAt: 'desc' },
      include: {
        collaborator: true
      }
    })
  }

  static async getCommentById(id: string): Promise<Comment | null> {
    return await prisma.comment.findUnique({
      where: { id },
      include: {
        collaborator: true,
        page: {
          include: {
            chapter: {
              include: {
                book: true
              }
            }
          }
        },
        chapter: {
          include: {
            book: true
          }
        }
      }
    })
  }

  static async createPageComment(data: {
    content: string
    collaboratorId: string
    pageId: string
  }): Promise<Comment> {
    return await prisma.comment.create({
      data,
      include: {
        collaborator: true,
        page: true
      }
    })
  }

  static async createChapterComment(data: {
    content: string
    collaboratorId: string
    chapterId: string
  }): Promise<Comment> {
    return await prisma.comment.create({
      data,
      include: {
        collaborator: true,
        chapter: true
      }
    })
  }

  static async updateComment(
    id: string,
    data: Partial<Pick<Comment, 'content' | 'resolved'>>
  ): Promise<Comment> {
    return await prisma.comment.update({
      where: { id },
      data,
      include: {
        collaborator: true
      }
    })
  }

  static async deleteComment(id: string): Promise<Comment> {
    return await prisma.comment.delete({
      where: { id }
    })
  }

  static async resolveComment(id: string): Promise<Comment> {
    return await this.updateComment(id, { resolved: true })
  }

  static async unresolveComment(id: string): Promise<Comment> {
    return await this.updateComment(id, { resolved: false })
  }

  static async getCommentsByCollaborator(collaboratorId: string): Promise<Comment[]> {
    return await prisma.comment.findMany({
      where: { collaboratorId },
      orderBy: { createdAt: 'desc' },
      include: {
        page: {
          include: {
            chapter: {
              include: {
                book: true
              }
            }
          }
        },
        chapter: {
          include: {
            book: true
          }
        }
      }
    })
  }

  static async getUnresolvedComments(bookId: string): Promise<Comment[]> {
    return await prisma.comment.findMany({
      where: {
        resolved: false,
        OR: [
          {
            page: {
              chapter: {
                bookId
              }
            }
          },
          {
            chapter: {
              bookId
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        collaborator: true,
        page: {
          include: {
            chapter: true
          }
        },
        chapter: true
      }
    })
  }

  static async getCommentStats(bookId: string) {
    const [totalComments, unresolvedComments, resolvedComments] = await Promise.all([
      prisma.comment.count({
        where: {
          OR: [
            {
              page: {
                chapter: {
                  bookId
                }
              }
            },
            {
              chapter: {
                bookId
              }
            }
          ]
        }
      }),
      prisma.comment.count({
        where: {
          resolved: false,
          OR: [
            {
              page: {
                chapter: {
                  bookId
                }
              }
            },
            {
              chapter: {
                bookId
              }
            }
          ]
        }
      }),
      prisma.comment.count({
        where: {
          resolved: true,
          OR: [
            {
              page: {
                chapter: {
                  bookId
                }
              }
            },
            {
              chapter: {
                bookId
              }
            }
          ]
        }
      })
    ])

    return {
      total: totalComments,
      unresolved: unresolvedComments,
      resolved: resolvedComments,
      resolutionRate: totalComments > 0 ? Math.round((resolvedComments / totalComments) * 100) : 0
    }
  }
} 