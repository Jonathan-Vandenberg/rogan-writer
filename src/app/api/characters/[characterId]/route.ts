import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { CharacterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const character = await CharacterService.getCharacterById(resolvedParams.characterId)
    
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }
    
    return NextResponse.json(character)
  } catch (error) {
    console.error('Error fetching character:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const data = await request.json()
    
    const character = await CharacterService.updateCharacter(resolvedParams.characterId, {
      name: data.name,
      description: data.description,
      appearance: data.appearance,
      personality: data.personality,
      backstory: data.backstory,
      role: data.role,
      imageUrl: data.imageUrl
    })
    
    // 🚀 AUTO-UPDATE UNIFIED VECTOR STORE for character updates
    try {
      const { unifiedEmbeddingService } = await import('@/services/unified-embedding.service')
      
      const content = [
        `Character: ${character.name}`,
        character.role ? `Role: ${character.role}` : '',
        character.description ? `Description: ${character.description}` : '',
        character.appearance ? `Appearance: ${character.appearance}` : '',
        character.personality ? `Personality: ${character.personality}` : '',
        character.backstory ? `Backstory: ${character.backstory}` : ''
      ].filter(Boolean).join('\n\n');
      
      await unifiedEmbeddingService.updateSourceEmbeddings({
        bookId: character.bookId,
        sourceType: 'character',
        sourceId: character.id,
        content,
        metadata: { name: character.name, role: character.role }
      })
      console.log(`✅ Updated unified embeddings for character: ${character.name}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to update unified embeddings for character ${resolvedParams.characterId}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }
    
    return NextResponse.json(character)
  } catch (error) {
    console.error('Error updating character:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    await CharacterService.deleteCharacter(resolvedParams.characterId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting character:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 