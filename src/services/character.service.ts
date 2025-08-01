import { prisma } from '@/lib/db'
import type { Character, CharacterRole, Prisma } from '@prisma/client'

export class CharacterService {
  static async getCharactersByBookId(bookId: string): Promise<Character[]> {
    return await prisma.character.findMany({
      where: { bookId },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ],
      include: {
        relationships: {
          include: {
            characterTo: true
          }
        },
        relatedTo: {
          include: {
            characterFrom: true
          }
        },
        _count: {
          select: {
            timelineEvents: true,
            relationships: true,
            relatedTo: true
          }
        }
      }
    })
  }

  static async getCharacterById(id: string): Promise<Character | null> {
    return await prisma.character.findUnique({
      where: { id },
      include: {
        book: true,
        relationships: {
          include: {
            characterTo: true
          }
        },
        relatedTo: {
          include: {
            characterFrom: true
          }
        },
        timelineEvents: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    })
  }

  static async createCharacter(data: {
    name: string
    description?: string
    appearance?: string
    personality?: string
    backstory?: string
    role?: CharacterRole
    imageUrl?: string
    bookId: string
  }): Promise<Character> {
    return await prisma.character.create({
      data: {
        ...data,
        role: data.role || 'MINOR'
      }
    })
  }

  static async updateCharacter(
    id: string, 
    data: Partial<Pick<Character, 'name' | 'description' | 'appearance' | 'personality' | 'backstory' | 'role' | 'imageUrl'>>
  ): Promise<Character> {
    return await prisma.character.update({
      where: { id },
      data
    })
  }

  static async deleteCharacter(id: string): Promise<Character> {
    return await prisma.character.delete({
      where: { id }
    })
  }

  static async getCharactersByRole(bookId: string, role: CharacterRole): Promise<Character[]> {
    return await prisma.character.findMany({
      where: { 
        bookId,
        role 
      },
      orderBy: { name: 'asc' }
    })
  }

  static async searchCharacters(bookId: string, searchTerm: string): Promise<Character[]> {
    return await prisma.character.findMany({
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
          }
        ]
      },
      orderBy: { name: 'asc' }
    })
  }

  static async getCharacterStats(id: string) {
    const character = await prisma.character.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            timelineEvents: true,
            relationships: true,
            relatedTo: true
          }
        }
      }
    })

    if (!character) return null

    return {
      ...character,
      stats: {
        timelineEventsCount: character._count.timelineEvents,
        relationshipsCount: character._count.relationships + character._count.relatedTo,
        totalConnections: character._count.relationships + character._count.relatedTo
      }
    }
  }

  static async updateEmbedding(id: string, embedding: number[]): Promise<Character> {
    // TODO: Implement proper vector embedding update when AI features are ready
    // For now, just return the character without updating embedding
    return await prisma.character.findUniqueOrThrow({
      where: { id }
    })
  }
} 