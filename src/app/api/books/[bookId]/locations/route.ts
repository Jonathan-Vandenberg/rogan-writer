import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { LocationService } from '@/services'

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
    const locations = await LocationService.getLocationsByBookId(bookId)
    
    return NextResponse.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
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
    const { bookId } = await params
    
    const location = await LocationService.createLocation({
      name: data.name,
      description: data.description,
      geography: data.geography,
      culture: data.culture,
      rules: data.rules,
      imageUrl: data.imageUrl,
      bookId: bookId
    })
    
    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('Error creating location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 