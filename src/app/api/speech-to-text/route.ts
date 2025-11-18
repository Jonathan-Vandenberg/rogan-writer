import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    // Get user session for logging
    const session = await auth()
    const userId = session?.user?.id

    // Check if OpenAI API key is configured
    // Note: Whisper requires direct OpenAI API access (not through OpenRouter)
    if (!process.env.OPENAI_API_KEY) {
      console.log(`❌ [Speech-to-Text] No OpenAI API key in environment variables`)
      
      // Check if user has OpenRouter configured (for informational purposes)
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { openRouterApiKey: true },
        })
        if (user?.openRouterApiKey) {
          console.log(`ℹ️  [Speech-to-Text] User has OpenRouter configured, but Whisper requires direct OpenAI API access`)
        }
      }
      
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Whisper requires direct OpenAI API access (not through OpenRouter).' },
        { status: 500 }
      )
    }

    // Log which API key we're using
    if (userId) {
      console.log(`🔍 [Speech-to-Text] Checking user's API configuration (userId: ${userId})`)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { openRouterApiKey: true },
      })
      if (user?.openRouterApiKey) {
        console.log(`ℹ️  [Speech-to-Text] User has OpenRouter configured, but Whisper requires direct OpenAI API`)
      }
      console.log(`✅ [Speech-to-Text] Using OpenAI API key from environment variables (NOT user's OpenRouter key)`)
      console.log(`🔒 [Speech-to-Text] Note: Whisper API requires direct OpenAI access, not available through OpenRouter`)
    } else {
      console.log(`✅ [Speech-to-Text] Using OpenAI API key from environment variables`)
    }

    // Initialize OpenAI client with env key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en'
    const prompt = formData.get('prompt') as string || undefined // Optional prompt to guide transcription
    const temperature = formData.get('temperature') as string | undefined // Optional temperature (0.0-1.0)

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Convert the File to a format OpenAI can accept
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    
    // Create a File-like object that OpenAI accepts
    const audioForOpenAI = new File([audioBuffer], 'audio.webm', {
      type: audioFile.type || 'audio/webm'
    })

    // Build transcription options
    const transcriptionOptions: any = {
      file: audioForOpenAI,
      model: 'whisper-1',
      language: language.substring(0, 2), // OpenAI expects 2-letter language codes
      response_format: 'json',
      temperature: temperature ? parseFloat(temperature) : 0.2, // Lower temperature for more consistent results
    }

    // Add prompt if provided (helps with proper nouns, technical terms, etc.)
    if (prompt && prompt.trim()) {
      transcriptionOptions.prompt = prompt.trim()
      console.log(`📝 [Speech-to-Text] Using custom prompt: ${prompt.substring(0, 50)}...`)
    }

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create(transcriptionOptions)

    const transcript = transcription.text.trim()

    if (!transcript) {
      return NextResponse.json(
        { error: 'No speech detected in audio' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      transcript,
      language,
      confidence: 1.0, // OpenAI doesn't provide confidence scores
      provider: 'openai-whisper'
    })

  } catch (error) {
    console.error('Speech-to-text API error:', error)
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid API key')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key' },
          { status: 401 }
        )
      }
      
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded' },
          { status: 429 }
        )
      }
      
      if (error.message.includes('audio')) {
        return NextResponse.json(
          { error: 'Invalid audio format or file too large' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
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