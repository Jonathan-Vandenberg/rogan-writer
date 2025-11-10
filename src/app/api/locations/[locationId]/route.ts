import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { LocationService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const location = await LocationService.getLocationById(resolvedParams.locationId)
    
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }
    
    return NextResponse.json(location)
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const data = await request.json()
    
    const location = await LocationService.updateLocation(resolvedParams.locationId, {
      name: data.name,
      description: data.description,
      geography: data.geography,
      culture: data.culture,
      rules: data.rules,
      imageUrl: data.imageUrl
    })
    
    // 🚀 AUTO-REGENERATE EMBEDDING for location updates (all fields affect embedding)
    try {
      const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
      await aiEmbeddingService.updateLocationEmbedding(resolvedParams.locationId)
      console.log(`✅ Updated embedding for location: ${resolvedParams.locationId}`)
    } catch (embeddingError) {
      console.error(`⚠️ Failed to update embedding for location ${resolvedParams.locationId}:`, embeddingError)
      // Don't fail the request if embedding generation fails
    }
    
    return NextResponse.json(location)
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    await LocationService.deleteLocation(resolvedParams.locationId)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 