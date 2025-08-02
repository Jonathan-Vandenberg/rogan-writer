import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { CharacterService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const characters = await CharacterService.getCharactersByBookId(bookId)
    
    return NextResponse.json(characters)
  } catch (error) {
    console.error('Error fetching characters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const character = await CharacterService.createCharacter({
      name: data.name,
      description: data.description,
      appearance: data.appearance,
      personality: data.personality,
      backstory: data.backstory,
      role: data.role,
      imageUrl: data.imageUrl,
      bookId: params.bookId
    })
    
    return NextResponse.json(character, { status: 201 })
  } catch (error) {
    console.error('Error creating character:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 