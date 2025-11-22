import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/services/encryption.service'
import { OpenRouterService } from '@/services/openrouter.service'

/**
 * GET /api/user/settings/model-details?modelId=...
 * Get details and available options for a specific model
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      return NextResponse.json({ error: 'modelId is required' }, { status: 400 })
    }

    // Get user's API key
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openRouterApiKey: true },
    })

    if (!user?.openRouterApiKey) {
      return NextResponse.json({ 
        error: 'OpenRouter API key not configured'
      }, { status: 400 })
    }

    const apiKey = decrypt(user.openRouterApiKey)
    const openRouterService = new OpenRouterService(apiKey)

    // Get model info
    const modelInfo = await openRouterService.getModelInfo(modelId)

    if (!modelInfo) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Detect available options based on model ID and properties
    const options = {
      supportsThinking: detectThinkingSupport(modelId, modelInfo),
      supportsTemperature: true, // Most models support temperature
      supportsTopP: true, // Most models support top_p
      supportsMaxTokens: true, // Most models support max_tokens
    }

    return NextResponse.json({
      model: modelInfo,
      options,
    })
  } catch (error) {
    console.error('Error fetching model details:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch model details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Detect if a model supports thinking/reasoning mode
 * Based on model ID patterns and known reasoning models
 */
function detectThinkingSupport(modelId: string, modelInfo: any): boolean {
  const id = modelId.toLowerCase()
  
  // Check for known reasoning/thinking model patterns
  if (
    id.includes('reasoning') ||
    id.includes('thinking') ||
    id.includes('grok') && (id.includes('reasoning') || id.includes('beta')) ||
    id.includes('o1') || // OpenAI O1 models support reasoning
    id.includes('deepseek') && id.includes('reasoner')
  ) {
    return true
  }

  // Check model name/description for reasoning indicators
  const name = (modelInfo.name || '').toLowerCase()
  const description = (modelInfo.description || '').toLowerCase()
  
  if (
    name.includes('reasoning') ||
    name.includes('thinking') ||
    description.includes('reasoning') ||
    description.includes('thinking')
  ) {
    return true
  }

  return false
}

