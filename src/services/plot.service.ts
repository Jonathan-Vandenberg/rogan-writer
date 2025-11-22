import { prisma } from "@/lib/db"
import type { PlotPoint, PlotPointType } from "@prisma/client"

export class PlotService {
  static async getPlotPointsByBookId(bookId: string): Promise<PlotPoint[]> {
    return await prisma.plotPoint.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' }
    })
  }

  static async getPlotPointsBySubplot(bookId: string, subplot: string): Promise<PlotPoint[]> {
    return await prisma.plotPoint.findMany({
      where: { bookId, subplot },
      orderBy: { orderIndex: 'asc' }
    })
  }

  static async createPlotPoint(data: {
    type: PlotPointType
    title: string
    description?: string
    orderIndex: number
    subplot?: string | null
    bookId: string
    chapterId?: string
  }): Promise<PlotPoint> {
    // Normalize subplot: empty string, undefined, or null all become null
    const normalizedSubplot = !data.subplot || (typeof data.subplot === 'string' && data.subplot.trim() === '') ? null : data.subplot
    
    // Check if plot point already exists (unique constraint: bookId, type, subplot)
    const existing = await prisma.plotPoint.findFirst({
      where: {
        bookId: data.bookId,
        type: data.type,
        subplot: normalizedSubplot
      }
    })

    if (existing) {
      // Return existing plot point instead of throwing error
      return existing
    }

    // Create with normalized subplot
    return await prisma.plotPoint.create({
      data: {
        ...data,
        subplot: normalizedSubplot
      }
    })
  }

  static async updatePlotPoint(id: string, data: {
    title?: string
    description?: string
    completed?: boolean
    orderIndex?: number
    chapterId?: string
  }): Promise<PlotPoint> {
    return await prisma.plotPoint.update({
      where: { id },
      data
    })
  }

  static async markPlotPointComplete(id: string): Promise<PlotPoint> {
    return await prisma.plotPoint.update({
      where: { id },
      data: { completed: true }
    })
  }

  static async deletePlotPoint(id: string): Promise<PlotPoint> {
    return await prisma.plotPoint.delete({
      where: { id }
    })
  }

  static async getPlotProgress(bookId: string) {
    const plotPoints = await this.getPlotPointsByBookId(bookId)
    const mainPlotPoints = plotPoints.filter(p => p.subplot === 'main' || !p.subplot)
    
    const completedCount = mainPlotPoints.filter(p => p.completed).length
    const totalCount = mainPlotPoints.length
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

    // Map plot points to their status
    const plotStatus = mainPlotPoints.map(point => ({
      type: point.type,
      title: point.title,
      completed: point.completed,
      description: point.description
    }))

    return {
      totalPoints: totalCount,
      completedPoints: completedCount,
      progressPercent: Math.round(progressPercent),
      plotStatus
    }
  }

  static async initializeDefaultPlotStructure(bookId: string): Promise<PlotPoint[]> {
    const defaultPlotPoints = [
      { type: 'HOOK' as PlotPointType, title: 'Hero in opposite state', orderIndex: 1 },
      { type: 'PLOT_TURN_1' as PlotPointType, title: 'Call to adventure', orderIndex: 2 },
      { type: 'PINCH_1' as PlotPointType, title: 'First obstacle', orderIndex: 3 },
      { type: 'MIDPOINT' as PlotPointType, title: 'Point of no return', orderIndex: 4 },
      { type: 'PINCH_2' as PlotPointType, title: 'Dark moment', orderIndex: 5 },
      { type: 'PLOT_TURN_2' as PlotPointType, title: 'Final revelation', orderIndex: 6 },
      { type: 'RESOLUTION' as PlotPointType, title: 'New equilibrium', orderIndex: 7 },
    ]

    const createdPoints = []
    for (const point of defaultPlotPoints) {
      const created = await this.createPlotPoint({
        ...point,
        description: `Plot point for ${point.title}`,
        subplot: 'main',
        bookId
      })
      createdPoints.push(created)
    }

    return createdPoints
  }
} 