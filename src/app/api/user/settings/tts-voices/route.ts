import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/user/settings/tts-voices?model=...
 * Get available voices for a specific TTS model
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const model = searchParams.get('model') || 'tts-1'

    // Verify user has API key configured (required for TTS, but we don't need to decrypt it here)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openRouterApiKey: true },
    })

    if (!user?.openRouterApiKey) {
      return NextResponse.json({ 
        error: 'OpenRouter API key not configured'
      }, { status: 400 })
    }
    
    // Map TTS models to their available voices
    // For OpenAI TTS models (tts-1, tts-1-hd), all voices are available
    // For other providers via OpenRouter, we may need to check their API
    const voicesByModel: Record<string, Array<{ value: string; label: string; description?: string }>> = {
      'tts-1': [
        { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced voice' },
        { value: 'echo', label: 'Echo', description: 'Male voice' },
        { value: 'fable', label: 'Fable', description: 'Male voice' },
        { value: 'onyx', label: 'Onyx', description: 'Male voice' },
        { value: 'nova', label: 'Nova', description: 'Female voice' },
        { value: 'shimmer', label: 'Shimmer', description: 'Female voice' },
      ],
      'tts-1-hd': [
        { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced voice' },
        { value: 'echo', label: 'Echo', description: 'Male voice' },
        { value: 'fable', label: 'Fable', description: 'Male voice' },
        { value: 'onyx', label: 'Onyx', description: 'Male voice' },
        { value: 'nova', label: 'Nova', description: 'Female voice' },
        { value: 'shimmer', label: 'Shimmer', description: 'Female voice' },
      ],
    }

    // If model is OpenAI TTS, return standard voices
    // Check for various OpenAI TTS model formats (e.g., "openai/tts-1", "tts-1", etc.)
    const modelLower = model.toLowerCase()
    if (
      modelLower.startsWith('tts-1') || 
      modelLower.includes('openai/tts') ||
      (modelLower.includes('tts') && !modelLower.includes('embed')) ||
      modelLower === 'openai/tts-1' ||
      modelLower === 'openai/tts-1-hd'
    ) {
      // Determine which model variant
      const isHD = modelLower.includes('hd') || modelLower.includes('tts-1-hd')
      return NextResponse.json({
        voices: voicesByModel['tts-1'], // Both tts-1 and tts-1-hd use same voices
        model,
        modelType: isHD ? 'tts-1-hd' : 'tts-1',
      })
    }

    // For other models, try to fetch from OpenRouter if possible
    // For now, return default OpenAI voices as fallback
    // TODO: In the future, we could query OpenRouter's model info endpoint
    // to get available voices for other TTS providers
    
    return NextResponse.json({
      voices: voicesByModel['tts-1'], // Default fallback
      model,
      note: 'Using default OpenAI voices. Other providers may have different options.',
    })
  } catch (error) {
    console.error('Error fetching TTS voices:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch TTS voices',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

