import { prisma } from '@/lib/db'
import type { CharacterRelationship } from '@prisma/client'

export class CharacterRelationshipService {
  static async getRelationshipsByCharacterId(characterId: string): Promise<CharacterRelationship[]> {
    return await prisma.characterRelationship.findMany({
      where: {
        OR: [
          { characterFromId: characterId },
          { characterToId: characterId }
        ]
      },
      include: {
        characterFrom: true,
        characterTo: true
      }
    })
  }

  static async getRelationshipById(id: string): Promise<CharacterRelationship | null> {
    return await prisma.characterRelationship.findUnique({
      where: { id },
      include: {
        characterFrom: true,
        characterTo: true
      }
    })
  }

  static async createRelationship(data: {
    characterFromId: string
    characterToId: string
    relationship: string
    description?: string
  }): Promise<CharacterRelationship> {
    return await prisma.characterRelationship.create({
      data,
      include: {
        characterFrom: true,
        characterTo: true
      }
    })
  }

  static async updateRelationship(
    id: string,
    data: Partial<Pick<CharacterRelationship, 'relationship' | 'description'>>
  ): Promise<CharacterRelationship> {
    return await prisma.characterRelationship.update({
      where: { id },
      data,
      include: {
        characterFrom: true,
        characterTo: true
      }
    })
  }

  static async deleteRelationship(id: string): Promise<CharacterRelationship> {
    return await prisma.characterRelationship.delete({
      where: { id }
    })
  }

  static async getRelationshipsByType(bookId: string, relationshipType: string): Promise<CharacterRelationship[]> {
    return await prisma.characterRelationship.findMany({
      where: {
        relationship: relationshipType,
        characterFrom: {
          bookId
        }
      },
      include: {
        characterFrom: true,
        characterTo: true
      }
    })
  }

  static async checkRelationshipExists(characterFromId: string, characterToId: string): Promise<boolean> {
    const relationship = await prisma.characterRelationship.findUnique({
      where: {
        characterFromId_characterToId: {
          characterFromId,
          characterToId
        }
      }
    })

    return !!relationship
  }
} 