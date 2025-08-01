import { prisma } from '@/lib/db'
import type { TimelineEvent } from '@prisma/client'

export class TimelineEventService {
  static async getTimelineEventsByBookId(bookId: string): Promise<TimelineEvent[]> {
    return await prisma.timelineEvent.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
      include: {
        character: true,
        location: true
      }
    })
  }

  static async getTimelineEventById(id: string): Promise<TimelineEvent | null> {
    return await prisma.timelineEvent.findUnique({
      where: { id },
      include: {
        book: true,
        character: true,
        location: true
      }
    })
  }

  static async createTimelineEvent(data: {
    title: string
    description?: string
    eventDate?: string
    startTime: number
    endTime: number
    bookId: string
    characterId?: string
    locationId?: string
  }): Promise<TimelineEvent> {
    // Get the next order index
    const lastEvent = await prisma.timelineEvent.findFirst({
      where: { bookId: data.bookId },
      orderBy: { orderIndex: 'desc' }
    })
    
    const orderIndex = lastEvent ? lastEvent.orderIndex + 1 : 0

    return await prisma.timelineEvent.create({
      data: {
        ...data,
        orderIndex
      },
      include: {
        character: true,
        location: true
      }
    })
  }

  static async updateTimelineEvent(
    id: string,
    data: Partial<Pick<TimelineEvent, 'title' | 'description' | 'eventDate' | 'startTime' | 'endTime' | 'orderIndex' | 'characterId' | 'locationId'>>
  ): Promise<TimelineEvent> {
    return await prisma.timelineEvent.update({
      where: { id },
      data,
      include: {
        character: true,
        location: true
      }
    })
  }

  static async deleteTimelineEvent(id: string): Promise<TimelineEvent> {
    return await prisma.timelineEvent.delete({
      where: { id }
    })
  }

  static async reorderTimelineEvents(bookId: string, eventIds: string[]): Promise<void> {
    const updates = eventIds.map((eventId, index) =>
      prisma.timelineEvent.update({
        where: { id: eventId },
        data: { orderIndex: index }
      })
    )

    await prisma.$transaction(updates)
  }

  static async getTimelineEventsByCharacter(characterId: string): Promise<TimelineEvent[]> {
    return await prisma.timelineEvent.findMany({
      where: { characterId },
      orderBy: { orderIndex: 'asc' },
      include: {
        location: true
      }
    })
  }

  static async getTimelineEventsByLocation(locationId: string): Promise<TimelineEvent[]> {
    return await prisma.timelineEvent.findMany({
      where: { locationId },
      orderBy: { orderIndex: 'asc' },
      include: {
        character: true
      }
    })
  }

  static async searchTimelineEvents(bookId: string, searchTerm: string): Promise<TimelineEvent[]> {
    return await prisma.timelineEvent.findMany({
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
          }
        ]
      },
      orderBy: { orderIndex: 'asc' },
      include: {
        character: true,
        location: true
      }
    })
  }
} 