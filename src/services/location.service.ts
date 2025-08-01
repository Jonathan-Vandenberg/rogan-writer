import { prisma } from '@/lib/db'
import type { Location } from '@prisma/client'

export class LocationService {
  static async getLocationsByBookId(bookId: string): Promise<Location[]> {
    return await prisma.location.findMany({
      where: { bookId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            timelineEvents: true
          }
        }
      }
    })
  }

  static async getLocationById(id: string): Promise<Location | null> {
    return await prisma.location.findUnique({
      where: { id },
      include: {
        book: true,
        timelineEvents: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    })
  }

  static async createLocation(data: {
    name: string
    description?: string
    geography?: string
    culture?: string
    rules?: string
    imageUrl?: string
    bookId: string
  }): Promise<Location> {
    return await prisma.location.create({
      data
    })
  }

  static async updateLocation(
    id: string,
    data: Partial<Pick<Location, 'name' | 'description' | 'geography' | 'culture' | 'rules' | 'imageUrl'>>
  ): Promise<Location> {
    return await prisma.location.update({
      where: { id },
      data
    })
  }

  static async deleteLocation(id: string): Promise<Location> {
    return await prisma.location.delete({
      where: { id }
    })
  }

  static async searchLocations(bookId: string, searchTerm: string): Promise<Location[]> {
    return await prisma.location.findMany({
      where: {
        bookId,
        OR: [
          {
            name: {
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
            geography: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        ]
      },
      orderBy: { name: 'asc' }
    })
  }

  static async getLocationStats(id: string) {
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            timelineEvents: true
          }
        }
      }
    })

    if (!location) return null

    return {
      ...location,
      stats: {
        timelineEventsCount: location._count.timelineEvents
      }
    }
  }
} 