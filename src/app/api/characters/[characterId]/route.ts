import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { CharacterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { characterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const character = await CharacterService.getCharacterById(params.characterId)
    
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
  { params }: { params: { characterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const character = await CharacterService.updateCharacter(params.characterId, {
      name: data.name,
      description: data.description,
      appearance: data.appearance,
      personality: data.personality,
      backstory: data.backstory,
      role: data.role,
      imageUrl: data.imageUrl
    })
    
    return NextResponse.json(character)
  } catch (error) {
    console.error('Error updating character:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { characterId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await CharacterService.deleteCharacter(params.characterId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting character:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 