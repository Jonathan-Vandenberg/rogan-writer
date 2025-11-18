import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt, decrypt, maskApiKey } from '@/services/encryption.service'
import { OpenRouterService } from '@/services/openrouter.service'

/**
 * GET /api/user/settings
 * Get user's OpenRouter settings (API key is masked)
 */
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        openRouterApiKey: true,
        openRouterEmbeddingModel: true,
        openRouterResearchModel: true,
        openRouterSuggestionsModel: true,
        openRouterDefaultModel: true,
        defaultModelTemperature: true,
        researchModelTemperature: true,
        suggestionsModelTemperature: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      openRouterApiKey: user.openRouterApiKey ? maskApiKey(decrypt(user.openRouterApiKey)) : null,
      openRouterEmbeddingModel: user.openRouterEmbeddingModel,
      openRouterResearchModel: user.openRouterResearchModel,
      openRouterSuggestionsModel: user.openRouterSuggestionsModel,
      openRouterDefaultModel: user.openRouterDefaultModel,
      isConfigured: !!user.openRouterApiKey,
      defaultModelTemperature: user.defaultModelTemperature ?? 0.7,
      researchModelTemperature: user.researchModelTemperature ?? 0.3,
      suggestionsModelTemperature: user.suggestionsModelTemperature ?? 0.8,
    })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/user/settings
 * Update user's OpenRouter settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      openRouterApiKey,
      openRouterEmbeddingModel,
      openRouterResearchModel,
      openRouterSuggestionsModel,
      openRouterDefaultModel,
      defaultModelTemperature,
      researchModelTemperature,
      suggestionsModelTemperature,
    } = body

    // Prepare update data
    const updateData: any = {}

    // Only update API key if provided (and not masked)
    if (openRouterApiKey !== undefined) {
      // Check if it's a masked key (contains ••••) - if so, don't update
      if (openRouterApiKey && !openRouterApiKey.includes('••••')) {
        updateData.openRouterApiKey = encrypt(openRouterApiKey.trim())
      } else if (openRouterApiKey === null || openRouterApiKey === '') {
        // Allow clearing the API key
        updateData.openRouterApiKey = null
      }
    }

    // Update model preferences
    if (openRouterEmbeddingModel !== undefined) {
      updateData.openRouterEmbeddingModel = openRouterEmbeddingModel || null
    }
    if (openRouterResearchModel !== undefined) {
      updateData.openRouterResearchModel = openRouterResearchModel || null
    }
    if (openRouterSuggestionsModel !== undefined) {
      updateData.openRouterSuggestionsModel = openRouterSuggestionsModel || null
    }
    if (openRouterDefaultModel !== undefined) {
      updateData.openRouterDefaultModel = openRouterDefaultModel || null
    }

    // Update temperature settings
    if (defaultModelTemperature !== undefined) {
      updateData.defaultModelTemperature = defaultModelTemperature
    }
    if (researchModelTemperature !== undefined) {
      updateData.researchModelTemperature = researchModelTemperature
    }
    if (suggestionsModelTemperature !== undefined) {
      updateData.suggestionsModelTemperature = suggestionsModelTemperature
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        openRouterApiKey: true,
        openRouterEmbeddingModel: true,
        openRouterResearchModel: true,
        openRouterSuggestionsModel: true,
        openRouterDefaultModel: true,
        defaultModelTemperature: true,
        researchModelTemperature: true,
        suggestionsModelTemperature: true,
      },
    })

    return NextResponse.json({
      openRouterApiKey: user.openRouterApiKey ? maskApiKey(decrypt(user.openRouterApiKey)) : null,
      openRouterEmbeddingModel: user.openRouterEmbeddingModel,
      openRouterResearchModel: user.openRouterResearchModel,
      openRouterSuggestionsModel: user.openRouterSuggestionsModel,
      openRouterDefaultModel: user.openRouterDefaultModel,
      isConfigured: !!user.openRouterApiKey,
      defaultModelTemperature: user.defaultModelTemperature ?? 0.7,
      researchModelTemperature: user.researchModelTemperature ?? 0.3,
      suggestionsModelTemperature: user.suggestionsModelTemperature ?? 0.8,
    })
  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json({ 
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

