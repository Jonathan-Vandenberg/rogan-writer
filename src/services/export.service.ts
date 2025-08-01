import { prisma } from '@/lib/db'
import type { Export, ExportFormat, ExportStatus } from '@prisma/client'

export class ExportService {
  static async getExportsByUserId(userId: string): Promise<Export[]> {
    return await prisma.export.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        book: true
      }
    })
  }

  static async getExportsByBookId(bookId: string): Promise<Export[]> {
    return await prisma.export.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: true
      }
    })
  }

  static async getExportById(id: string): Promise<Export | null> {
    return await prisma.export.findUnique({
      where: { id },
      include: {
        user: true,
        book: true
      }
    })
  }

  static async createExport(data: {
    format: ExportFormat
    fileName: string
    userId: string
    bookId: string
    settings?: any
  }): Promise<Export> {
    return await prisma.export.create({
      data: {
        ...data,
        status: 'PROCESSING',
        settings: data.settings || {}
      },
      include: {
        book: true
      }
    })
  }

  static async updateExportStatus(
    id: string,
    status: ExportStatus,
    fileUrl?: string
  ): Promise<Export> {
    const updateData: any = { status }
    
    if (fileUrl) {
      updateData.fileUrl = fileUrl
    }

    return await prisma.export.update({
      where: { id },
      data: updateData,
      include: {
        book: true,
        user: true
      }
    })
  }

  static async deleteExport(id: string): Promise<Export> {
    return await prisma.export.delete({
      where: { id }
    })
  }

  static async getExportsByFormat(userId: string, format: ExportFormat): Promise<Export[]> {
    return await prisma.export.findMany({
      where: { 
        userId,
        format 
      },
      orderBy: { createdAt: 'desc' },
      include: {
        book: true
      }
    })
  }

  static async getExportsByStatus(userId: string, status: ExportStatus): Promise<Export[]> {
    return await prisma.export.findMany({
      where: { 
        userId,
        status 
      },
      orderBy: { createdAt: 'desc' },
      include: {
        book: true
      }
    })
  }

  static async getProcessingExports(): Promise<Export[]> {
    return await prisma.export.findMany({
      where: { status: 'PROCESSING' },
      orderBy: { createdAt: 'asc' },
      include: {
        book: {
          include: {
            chapters: {
              include: {
                pages: {
                  orderBy: { pageNumber: 'asc' }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
        user: true
      }
    })
  }

  static async requestBookExport(
    userId: string,
    bookId: string,
    format: ExportFormat,
    settings?: any
  ): Promise<Export> {
    // Get book to generate filename
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true }
    })

    if (!book) {
      throw new Error('Book not found')
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const sanitizedTitle = book.title.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${sanitizedTitle}_${timestamp}.${format.toLowerCase()}`

    return await this.createExport({
      format,
      fileName,
      userId,
      bookId,
      settings
    })
  }

  static async getExportStats(userId: string) {
    const [total, processing, completed, failed] = await Promise.all([
      prisma.export.count({ where: { userId } }),
      prisma.export.count({ where: { userId, status: 'PROCESSING' } }),
      prisma.export.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.export.count({ where: { userId, status: 'FAILED' } })
    ])

    const [pdf, epub, docx, txt, html] = await Promise.all([
      prisma.export.count({ where: { userId, format: 'PDF' } }),
      prisma.export.count({ where: { userId, format: 'EPUB' } }),
      prisma.export.count({ where: { userId, format: 'DOCX' } }),
      prisma.export.count({ where: { userId, format: 'TXT' } }),
      prisma.export.count({ where: { userId, format: 'HTML' } })
    ])

    const recentExports = await prisma.export.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        book: {
          select: { title: true }
        }
      }
    })

    return {
      total,
      byStatus: {
        processing,
        completed,
        failed
      },
      byFormat: {
        pdf,
        epub,
        docx,
        txt,
        html
      },
      recentExports: recentExports.map(exp => ({
        id: exp.id,
        format: exp.format,
        fileName: exp.fileName,
        status: exp.status,
        bookTitle: exp.book.title,
        createdAt: exp.createdAt,
        fileUrl: exp.fileUrl
      })),
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }

  static async cleanupOldExports(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await prisma.export.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        status: 'COMPLETED'
      }
    })

    return result.count
  }
} 