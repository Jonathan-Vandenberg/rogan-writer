import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en'

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

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioForOpenAI,
      model: 'whisper-1',
      language: language.substring(0, 2), // OpenAI expects 2-letter language codes
      response_format: 'json',
      temperature: 0.2, // Lower temperature for more consistent results
    })

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
      supportedFormats: ['webm', 'mp3', 'mp4', 'wav', 'm4a', 'flac']
    },
    { status: 200 }
  )
} 