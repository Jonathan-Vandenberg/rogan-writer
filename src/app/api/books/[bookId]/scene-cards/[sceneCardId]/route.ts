import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SceneCardService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; sceneCardId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Get all scene cards and find the specific one (includes ownership validation via bookId)
    const sceneCards = await SceneCardService.getSceneCardsByBookId(resolvedParams.bookId)
    const sceneCard = sceneCards.find(s => s.id === resolvedParams.sceneCardId)
    
    if (!sceneCard) {
      return NextResponse.json({ error: 'Scene card not found' }, { status: 404 })
    }
    
    return NextResponse.json(sceneCard)
  } catch (error) {
    console.error('Error fetching scene card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookId: string; sceneCardId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify scene card belongs to this book first
    const sceneCards = await SceneCardService.getSceneCardsByBookId(resolvedParams.bookId)
    const existingCard = sceneCards.find(s => s.id === resolvedParams.sceneCardId)
    
    if (!existingCard) {
      return NextResponse.json({ error: 'Scene card not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, purpose, conflict, outcome, status, chapterId, orderIndex, wordCount } = body

    const updateData: { 
      title?: string
      description?: string
      purpose?: string
      conflict?: string
      outcome?: string
      status?: any
      chapterId?: string
      orderIndex?: number
      wordCount?: number
    } = {}
    
    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = title.trim()
    }
    
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }
    
    if (purpose !== undefined) {
      updateData.purpose = purpose?.trim() || null
    }

    if (conflict !== undefined) {
      updateData.conflict = conflict?.trim() || null
    }

    if (outcome !== undefined) {
      updateData.outcome = outcome?.trim() || null
    }

    if (status !== undefined) {
      updateData.status = status
    }

    if (chapterId !== undefined) {
      updateData.chapterId = chapterId || null
    }

    if (orderIndex !== undefined) {
      updateData.orderIndex = orderIndex
    }

    if (wordCount !== undefined) {
      updateData.wordCount = wordCount
    }

    const updatedCard = await SceneCardService.updateSceneCard(resolvedParams.sceneCardId, updateData)
    
    // 🚀 AUTO-REGENERATE EMBEDDING if title, description, purpose, conflict, or outcome changed
    if (updateData.title !== undefined || updateData.description !== undefined || 
        updateData.purpose !== undefined || updateData.conflict !== undefined || 
        updateData.outcome !== undefined) {
      try {
        const { aiEmbeddingService } = await import('@/services/ai-embedding.service')
        await aiEmbeddingService.updateSceneCardEmbedding(resolvedParams.sceneCardId)
        console.log(`✅ Updated embedding for scene card: ${resolvedParams.sceneCardId}`)
      } catch (embeddingError) {
        console.error(`⚠️ Failed to update embedding for scene card ${resolvedParams.sceneCardId}:`, embeddingError)
        // Don't fail the request if embedding generation fails
      }
    }
    
    return NextResponse.json(updatedCard)
  } catch (error) {
    console.error('Error updating scene card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; sceneCardId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify scene card belongs to this book first
    const sceneCards = await SceneCardService.getSceneCardsByBookId(resolvedParams.bookId)
    const existingCard = sceneCards.find(s => s.id === resolvedParams.sceneCardId)
    
    if (!existingCard) {
      return NextResponse.json({ error: 'Scene card not found' }, { status: 404 })
    }

    await SceneCardService.deleteSceneCard(resolvedParams.sceneCardId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scene card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 