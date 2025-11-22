import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt, maskApiKey } from '@/services/encryption.service'
import { OpenRouterService } from '@/services/openrouter.service'

/**
 * GET /api/user/settings/models
 * Fetch available models from OpenRouter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'all', 'chat', 'embeddings', 'tts', 'stt', 'images'
    const testApiKey = searchParams.get('apiKey') // Optional API key for testing

    let apiKey: string

    if (testApiKey) {
      // Use provided API key for testing
      console.log(`🧪 [Models API] Using test API key provided in request (not from database)`);
      apiKey = testApiKey
    } else {
      // Get user's saved API key
      console.log(`🔍 [Models API] Fetching user's OpenRouter API key from database (userId: ${session.user.id})`);
      console.log(`🔍 [Models API] NOT checking environment variables - using user's database-stored key only`);
      
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { openRouterApiKey: true },
      })

      if (!user?.openRouterApiKey) {
        console.log(`❌ [Models API] No OpenRouter API key found in user's database record`);
        return NextResponse.json({ 
          error: 'OpenRouter API key not configured. Please add your API key in settings.'
        }, { status: 400 })
      }

      apiKey = decrypt(user.openRouterApiKey)
      const maskedKey = maskApiKey(apiKey)
      console.log(`✅ [Models API] Found user's OpenRouter API key in database: ${maskedKey}`);
      console.log(`✅ [Models API] Using USER'S API KEY from database (NOT env variables)`);
      console.log(`🔒 [Models API] Environment OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'EXISTS but NOT USED' : 'NOT SET (as expected)'}`);
    }
    const openRouterService = new OpenRouterService(apiKey)

    let models
    try {
      if (type === 'embeddings') {
        models = await openRouterService.getEmbeddingModels()
      } else if (type === 'chat') {
        models = await openRouterService.getChatModels()
      } else if (type === 'tts') {
        models = await openRouterService.getTTSModels()
      } else if (type === 'stt') {
        models = await openRouterService.getSTTModels()
      } else if (type === 'images') {
        models = await openRouterService.getImageModels()
      } else {
        models = await openRouterService.getAvailableModels()
      }
      
      console.log(`Fetched ${models.length} ${type || 'all'} models from OpenRouter`)
      
      return NextResponse.json({ models })
    } catch (error) {
      console.error(`Error fetching ${type} models:`, error)
      throw error
    }
  } catch (error) {
    console.error('Error fetching models:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch models',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

