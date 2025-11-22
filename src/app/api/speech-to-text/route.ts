import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/services/encryption.service'
import { OpenRouterService } from '@/services/openrouter.service'

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's OpenRouter configuration
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        openRouterApiKey: true, 
        openRouterSTTModel: true 
      },
    })

    if (!user?.openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Please configure your OpenRouter API key in settings.' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en'
    const prompt = formData.get('prompt') as string | undefined
    const temperature = formData.get('temperature') as string | undefined

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const temp = temperature ? parseFloat(temperature) : 0.2

    console.log(`🌐 [Speech-to-Text] Using OpenRouter API (userId: ${userId})`)
    
    const apiKey = decrypt(user.openRouterApiKey)
    const openRouterService = new OpenRouterService(apiKey)
    
    // Use user's selected STT model or default to openai/whisper-1
    const sttModel = user.openRouterSTTModel || 'openai/whisper-1'
    console.log(`📝 [Speech-to-Text] Using STT model: ${sttModel}`)
    
    const result = await openRouterService.transcribeAudio(
      audioBuffer,
      sttModel,
      language,
      prompt,
      temp
    )

    if (!result.transcript || !result.transcript.trim()) {
      return NextResponse.json(
        { error: 'No speech detected in audio' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      transcript: result.transcript.trim(),
      language: result.language || language,
      confidence: 1.0,
      provider: 'openrouter',
      model: result.model
    })

  } catch (error) {
    console.error('Speech-to-text API error:', error)
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid API key') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Invalid OpenRouter API key. Please check your API key in settings.' },
          { status: 401 }
        )
      }
      
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'OpenRouter API quota exceeded. Please try again later.' },
          { status: 429 }
        )
      }
      
      if (error.message.includes('audio') || error.message.includes('format')) {
        return NextResponse.json(
          { error: 'Invalid audio format or file too large' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio via OpenRouter',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Speech-to-text API endpoint',
      supportedLanguages: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
        'ar', 'hi', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'tr', 'he'
      ],
      maxFileSize: '25MB',
      supportedFormats: ['webm', 'mp3', 'mp4', 'wav', 'm4a', 'flac'],
      parameters: {
        language: 'Language code (e.g., "en", "es") - optional, auto-detected if not provided',
        prompt: 'Optional text prompt to guide transcription (helps with proper nouns, technical terms)',
        temperature: 'Optional temperature (0.0-1.0), default 0.2. Lower = more consistent, higher = more creative'
      },
      note: 'Note: Whisper API does not support speaker diarization (identifying different speakers). For speaker selection in text-to-speech, use the audiobook generation feature.'
    },
    { status: 200 }
  )
} 