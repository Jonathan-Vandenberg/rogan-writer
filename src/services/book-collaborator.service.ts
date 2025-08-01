import { prisma } from '@/lib/db'
import type { BookCollaborator, CollaboratorRole, InviteStatus } from '@prisma/client'

export class BookCollaboratorService {
  static async getCollaboratorsByBookId(bookId: string): Promise<BookCollaborator[]> {
    return await prisma.bookCollaborator.findMany({
      where: { bookId },
      orderBy: { invitedAt: 'desc' },
      include: {
        _count: {
          select: {
            comments: true
          }
        }
      }
    })
  }

  static async getCollaboratorById(id: string): Promise<BookCollaborator | null> {
    return await prisma.bookCollaborator.findUnique({
      where: { id },
      include: {
        book: true,
        comments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  }

  static async getCollaboratorByEmail(bookId: string, email: string): Promise<BookCollaborator | null> {
    return await prisma.bookCollaborator.findUnique({
      where: {
        bookId_email: {
          bookId,
          email
        }
      }
    })
  }

  static async inviteCollaborator(data: {
    bookId: string
    email: string
    role: CollaboratorRole
  }): Promise<BookCollaborator> {
    return await prisma.bookCollaborator.create({
      data: {
        ...data,
        inviteStatus: 'PENDING'
      }
    })
  }

  static async updateCollaboratorRole(
    id: string,
    role: CollaboratorRole
  ): Promise<BookCollaborator> {
    return await prisma.bookCollaborator.update({
      where: { id },
      data: { role }
    })
  }

  static async updateInviteStatus(
    id: string,
    inviteStatus: InviteStatus
  ): Promise<BookCollaborator> {
    const data: any = { inviteStatus }
    
    if (inviteStatus === 'ACCEPTED') {
      data.joinedAt = new Date()
    }

    return await prisma.bookCollaborator.update({
      where: { id },
      data
    })
  }

  static async removeCollaborator(id: string): Promise<BookCollaborator> {
    return await prisma.bookCollaborator.delete({
      where: { id }
    })
  }

  static async getCollaboratorsByRole(bookId: string, role: CollaboratorRole): Promise<BookCollaborator[]> {
    return await prisma.bookCollaborator.findMany({
      where: { 
        bookId,
        role 
      },
      orderBy: { invitedAt: 'desc' }
    })
  }

  static async getCollaboratorsByStatus(bookId: string, inviteStatus: InviteStatus): Promise<BookCollaborator[]> {
    return await prisma.bookCollaborator.findMany({
      where: { 
        bookId,
        inviteStatus 
      },
      orderBy: { invitedAt: 'desc' }
    })
  }

  static async getActiveCollaborators(bookId: string): Promise<BookCollaborator[]> {
    return await prisma.bookCollaborator.findMany({
      where: { 
        bookId,
        inviteStatus: 'ACCEPTED'
      },
      orderBy: { joinedAt: 'desc' },
      include: {
        _count: {
          select: {
            comments: true
          }
        }
      }
    })
  }

  static async getCollaborationStats(bookId: string) {
    const [total, pending, accepted, declined] = await Promise.all([
      prisma.bookCollaborator.count({ where: { bookId } }),
      prisma.bookCollaborator.count({ where: { bookId, inviteStatus: 'PENDING' } }),
      prisma.bookCollaborator.count({ where: { bookId, inviteStatus: 'ACCEPTED' } }),
      prisma.bookCollaborator.count({ where: { bookId, inviteStatus: 'DECLINED' } })
    ])

    const [betaReaders, editors, coAuthors, viewers] = await Promise.all([
      prisma.bookCollaborator.count({ where: { bookId, role: 'BETA_READER' } }),
      prisma.bookCollaborator.count({ where: { bookId, role: 'EDITOR' } }),
      prisma.bookCollaborator.count({ where: { bookId, role: 'CO_AUTHOR' } }),
      prisma.bookCollaborator.count({ where: { bookId, role: 'VIEWER' } })
    ])

    return {
      total,
      byStatus: {
        pending,
        accepted,
        declined
      },
      byRole: {
        betaReaders,
        editors,
        coAuthors,
        viewers
      },
      activeCollaborators: accepted
    }
  }

  static async checkPermission(bookId: string, email: string, requiredRole?: CollaboratorRole): Promise<boolean> {
    const collaborator = await this.getCollaboratorByEmail(bookId, email)
    
    if (!collaborator || collaborator.inviteStatus !== 'ACCEPTED') {
      return false
    }

    if (!requiredRole) {
      return true
    }

    // Define role hierarchy
    const roleHierarchy = {
      'VIEWER': 1,
      'BETA_READER': 2,
      'EDITOR': 3,
      'CO_AUTHOR': 4
    }

    return roleHierarchy[collaborator.role] >= roleHierarchy[requiredRole]
  }
} 