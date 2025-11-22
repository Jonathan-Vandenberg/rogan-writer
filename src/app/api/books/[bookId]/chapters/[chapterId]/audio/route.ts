import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { openaiTTSService } from '@/services/openai-tts.service'
import { s3Service } from '@/services/s3.service'

// Increase timeout for audio generation (can take 1-2 minutes for long chapters)
// Vercel Pro: max 60s, Enterprise: max 300s (5 minutes)
export const maxDuration = 300; // 5 minutes (requires Vercel Enterprise)
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId, chapterId } = await params

    // Verify book ownership
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
        book: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        title: true,
        content: true,
        speakerName: true,
        audioStatus: true,
        orderIndex: true,
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    if (!chapter.content || chapter.content.trim() === '') {
      return NextResponse.json({ error: 'Chapter has no content to generate audio from' }, { status: 400 })
    }

    if (chapter.audioStatus === 'generating') {
      return NextResponse.json({ error: 'Audio generation already in progress for this chapter' }, { status: 409 })
    }

    // Check if OpenAI TTS is available
    const isHealthy = await openaiTTSService.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ 
        error: 'OpenAI TTS service is not available. Please set OPENAI_API_KEY in your environment.',
        details: 'Add OPENAI_API_KEY to your .env.local file'
      }, { status: 503 })
    }

    // Update status to generating
    await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        audioStatus: 'generating',
        audioError: null,
      },
    })

    console.log(`🎙️  Starting audio generation for Chapter ${chapter.orderIndex + 1}: "${chapter.title}"`)

    try {
      // Estimate cost
      const estimatedCost = openaiTTSService.estimateCost(chapter.content.length);
      console.log(`💰 Estimated cost: $${estimatedCost.toFixed(4)}`);

      // Get user's TTS preferences from settings
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          ttsVoice: true,
          openRouterTTSModel: true,
          ttsModel: true, // Keep for backward compatibility
        },
      })

      // Use user's preferred voice, or fall back to chapter's speakerName, or default to 'alloy'
      const voiceMap: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
        'alloy': 'alloy',
        'echo': 'echo',
        'fable': 'fable',
        'onyx': 'onyx',
        'nova': 'nova',
        'shimmer': 'shimmer',
        // Common name mappings
        'alice': 'alloy',
        'bob': 'onyx',
        'charlie': 'echo',
        'diana': 'nova',
        'eve': 'shimmer',
        'frank': 'fable',
      }
      
      // Priority: user preference > chapter speakerName > default
      const selectedVoice = user?.ttsVoice 
        ? (voiceMap[user.ttsVoice.toLowerCase()] || 'alloy')
        : chapter.speakerName 
          ? (voiceMap[chapter.speakerName.toLowerCase()] || 'alloy')
          : 'alloy'
      
      // Use user's preferred TTS model (openRouterTTSModel takes priority, fallback to ttsModel for backward compatibility)
      const userTTSModel = user?.openRouterTTSModel || user?.ttsModel || 'tts-1'
      // Extract model name if it's in format like "openai/tts-1" -> "tts-1"
      const selectedModel = (userTTSModel.includes('/') 
        ? userTTSModel.split('/').pop()?.toLowerCase() || 'tts-1'
        : userTTSModel.toLowerCase()) as 'tts-1' | 'tts-1-hd'
      
      console.log(`🎤 Using voice: ${selectedVoice} (from ${user?.ttsVoice ? 'user preference' : chapter.speakerName ? 'chapter speakerName' : 'default'})`)
      console.log(`🎙️  Using TTS model: ${selectedModel} (from ${userTTSModel ? `user preference: ${userTTSModel}` : 'default'})`)

      // Generate audio using OpenAI TTS with automatic chunking
      // Pass userId so it can use user's OpenRouter API key if configured
      const audioResult = await openaiTTSService.generateAudio({
        text: chapter.content,
        voice: selectedVoice,
        model: selectedModel,
        userId: session.user.id, // Pass userId to check for OpenRouter config
      })

      // Upload to S3
      const fileName = `chapter_${chapter.orderIndex + 1}_${Date.now()}.${audioResult.format}`
      const s3Result = await s3Service.uploadAudio({
        audioBuffer: audioResult.audioBuffer,
        bookId,
        chapterId,
        fileName,
        contentType: `audio/${audioResult.format}`,
      })

      // Update chapter with audio info
      const updatedChapter = await prisma.chapter.update({
        where: { id: chapterId },
        data: {
          audioUrl: s3Result.url,
          audioS3Key: s3Result.s3Key,
          audioDuration: audioResult.duration,
          audioGenerated: new Date(),
          audioStatus: 'completed',
          audioError: null,
        },
      })

      console.log(`✅ Audio generation completed for Chapter ${chapter.orderIndex + 1}`)

      return NextResponse.json({
        success: true,
        chapter: {
          id: updatedChapter.id,
          title: updatedChapter.title,
          audioUrl: updatedChapter.audioUrl,
          audioS3Key: updatedChapter.audioS3Key,
          audioDuration: updatedChapter.audioDuration,
          audioStatus: updatedChapter.audioStatus,
        },
      })

    } catch (generationError) {
      console.error('❌ Audio generation failed:', generationError)

      // Update status to failed
      await prisma.chapter.update({
        where: { id: chapterId },
        data: {
          audioStatus: 'failed',
          audioError: generationError instanceof Error ? generationError.message : 'Unknown error',
        },
      })

      return NextResponse.json({ 
        error: 'Failed to generate audio',
        details: generationError instanceof Error ? generationError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in audio generation API:', error)
    return NextResponse.json({ 
      error: 'Failed to process audio generation request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check audio status and retrieve audio URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId, chapterId } = await params

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
        book: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        title: true,
        audioUrl: true,
        audioS3Key: true,
        audioDuration: true,
        audioGenerated: true,
        audioStatus: true,
        audioError: true,
        speakerName: true,
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Generate signed URL if audio exists
    let signedUrl = null
    if (chapter.audioS3Key) {
      try {
        signedUrl = await s3Service.getSignedUrl(chapter.audioS3Key, 24 * 60 * 60) // 24 hour expiry
      } catch (error) {
        console.error('Error generating signed URL:', error)
      }
    }

    return NextResponse.json({
      success: true,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        audioUrl: chapter.audioUrl,
        signedUrl,
        audioDuration: chapter.audioDuration,
        audioGenerated: chapter.audioGenerated,
        audioStatus: chapter.audioStatus,
        audioError: chapter.audioError,
        speakerName: chapter.speakerName,
      },
    })

  } catch (error) {
    console.error('Error fetching audio info:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch audio information',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE endpoint to remove audio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId, chapterId } = await params

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
        book: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        audioS3Key: true,
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Delete from S3 if exists
    if (chapter.audioS3Key) {
      try {
        await s3Service.deleteAudio(chapter.audioS3Key)
      } catch (error) {
        console.error('Error deleting from S3:', error)
      }
    }

    // Update chapter to remove audio info
    await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        audioUrl: null,
        audioS3Key: null,
        audioDuration: null,
        audioGenerated: null,
        audioStatus: 'not_generated',
        audioError: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Audio deleted successfully',
    })

  } catch (error) {
    console.error('Error deleting audio:', error)
    return NextResponse.json({ 
      error: 'Failed to delete audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

