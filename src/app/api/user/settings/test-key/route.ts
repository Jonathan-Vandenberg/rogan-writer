import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/services/encryption.service'
import { OpenRouterService } from '@/services/openrouter.service'

/**
 * POST /api/user/settings/test-key
 * Test OpenRouter API key validity
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { apiKey } = body

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Test the API key
    const openRouterService = new OpenRouterService(apiKey.trim())
    const isValid = await openRouterService.testApiKey()

    if (!isValid) {
      return NextResponse.json({ 
        valid: false,
        error: 'Invalid API key. Please check your OpenRouter API key.'
      }, { status: 400 })
    }

    return NextResponse.json({ 
      valid: true,
      message: 'API key is valid'
    })
  } catch (error) {
    console.error('Error testing API key:', error)
    return NextResponse.json({ 
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to test API key'
    }, { status: 500 })
  }
}


