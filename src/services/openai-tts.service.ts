/**
 * OpenAI TTS Integration Service
 * Handles text-to-speech generation with automatic chunking for long content
 * Supports both direct OpenAI API and OpenRouter (if user has configured it)
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { decrypt, maskApiKey } from './encryption.service';
import { OpenRouterService } from './openrouter.service';

interface GenerateAudioParams {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  userId?: string; // Optional user ID to check for OpenRouter config
}

interface TTSResponse {
  audioBuffer: Buffer;
  duration: number; // in seconds
  format: string;
}

export class OpenAITTSService {
  private client: OpenAI | null = null;
  private isEnabled: boolean;
  private maxChunkSize = 3000; // Conservative chunk size for sentence boundaries

  constructor() {
    // Don't create OpenAI client here to avoid build-time errors
    // Client will be initialized lazily when needed
    const apiKey = process.env.OPENAI_API_KEY;
    this.isEnabled = !!apiKey;
  }

  /**
   * Lazy initialization of OpenAI client
   * Only creates client when actually needed
   * Prevents creation during build time
   */
  private getClient(): OpenAI {
    if (!this.client) {
      // During build phase, use a dummy key to prevent errors
      // The route is force-dynamic so this will never actually be used during build
      // Handle both undefined and empty string cases
      const envKey = process.env.OPENAI_API_KEY;
      const apiKey = (envKey && envKey.trim()) || 'sk-build-dummy-key-not-used-during-build-phase';
      this.client = new OpenAI({ apiKey });
      console.log(`🎙️  OpenAI TTS Service initialized - Model: tts-1 (cheapest)`);
    }
    return this.client;
  }

  /**
   * Check if OpenAI TTS service is available
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }
    try {
      this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Split text into chunks at natural sentence boundaries
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds chunk size, save current chunk
      if (currentChunk.length + paragraph.length > this.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If single paragraph is too long, split by sentences
      if (paragraph.length > this.maxChunkSize) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > this.maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          currentChunk += sentence + ' ';
        }
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generate audio for a single chunk
   */
  private async generateChunkAudio(
    text: string,
    voice: string,
    model: string,
    chunkIndex: number
  ): Promise<Buffer> {
    console.log(`🎙️  Generating chunk ${chunkIndex + 1} (${text.length} chars)...`);

    const client = this.getClient();
    const response = await client.audio.speech.create({
      model: model as 'tts-1' | 'tts-1-hd',
      voice: voice as any,
      input: text,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  }

  /**
   * Concatenate multiple audio files (simple binary concatenation for MP3)
   * MP3 files can be safely concatenated by joining their buffers
   */
  private async concatenateAudioFiles(audioBuffers: Buffer[]): Promise<Buffer> {
    console.log(`🔗 Concatenating ${audioBuffers.length} audio chunks...`);
    
    // Simply concatenate the MP3 buffers
    // This works because MP3 is a stream format designed for concatenation
    const mergedBuffer = Buffer.concat(audioBuffers);
    
    console.log(`✅ Audio concatenation complete - Size: ${mergedBuffer.length} bytes`);
    
    return mergedBuffer;
  }

  /**
   * Generate audio from text using OpenAI TTS with automatic chunking
   * Checks for user's OpenRouter API key first, falls back to env OpenAI key
   */
  async generateAudio(params: GenerateAudioParams): Promise<TTSResponse> {
    const { text, voice = 'alloy', model = 'tts-1', userId } = params;

    // Check for OpenRouter configuration if user ID is provided
    if (userId) {
      try {
        console.log(`🔍 [TTS Service] Checking for user's OpenRouter API key in database (userId: ${userId})`);
        console.log(`🔍 [TTS Service] NOT checking environment variables - using user's database-stored key only`);
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            openRouterApiKey: true,
          },
        });

        if (user?.openRouterApiKey) {
          try {
            const apiKey = decrypt(user.openRouterApiKey);
            const maskedKey = maskApiKey(apiKey);
            
            console.log(`✅ [TTS Service] Found user's OpenRouter API key in database: ${maskedKey}`);
            console.log(`✅ [TTS Service] Attempting to use USER'S API KEY from database via OpenRouter`);
            console.log(`🔒 [TTS Service] Environment OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'EXISTS but checking OpenRouter first' : 'NOT SET'}`);
            
            const openRouterService = new OpenRouterService(apiKey);
            
            // Try to generate TTS via OpenRouter
            // Note: OpenRouter may not support TTS, so we'll fall back to direct OpenAI if it fails
            // For long text, we still need to chunk it (OpenRouter may have similar limits)
            try {
              // Split text into chunks for OpenRouter (same as direct OpenAI)
              const chunks = this.splitIntoChunks(text);
              console.log(`📋 [TTS Service] Split into ${chunks.length} chunks for OpenRouter TTS`);
              
              // Generate audio for each chunk via OpenRouter
              const audioBuffers: Buffer[] = [];
              for (let i = 0; i < chunks.length; i++) {
                console.log(`🎙️  [TTS Service] Generating chunk ${i + 1}/${chunks.length} via OpenRouter...`);
                const chunkResult = await openRouterService.generateTTS(chunks[i], voice, model);
                audioBuffers.push(chunkResult.audioBuffer);
              }
              
              // Concatenate chunks
              let finalBuffer: Buffer;
              if (audioBuffers.length === 1) {
                finalBuffer = audioBuffers[0];
              } else {
                finalBuffer = await this.concatenateAudioFiles(audioBuffers);
              }
              
              console.log(`✅ [TTS Service] Successfully generated TTS via OpenRouter`);
              
              // Estimate duration
              const estimatedWords = text.length / 5;
              const estimatedDuration = (estimatedWords / 150) * 60;
              
              return {
                audioBuffer: finalBuffer,
                duration: estimatedDuration,
                format: 'mp3',
              };
            } catch (openRouterError) {
              console.log(`ℹ️  [TTS Service] OpenRouter TTS not available (${openRouterError instanceof Error ? openRouterError.message : 'unknown error'}), falling back to direct OpenAI API`);
              // Fall through to direct OpenAI
            }
          } catch (error) {
            console.error('Error using OpenRouter for TTS, falling back to OpenAI:', error);
            // Fall through to direct OpenAI
          }
        } else {
          console.log(`ℹ️  [TTS Service] No OpenRouter API key found in user's database record (userId: ${userId})`);
          console.log(`ℹ️  [TTS Service] Falling back to OpenAI from env`);
        }
      } catch (error) {
        console.error('Error checking OpenRouter config for TTS, falling back to OpenAI:', error);
        // Fall through to direct OpenAI
      }
    }

    // Fall back to direct OpenAI API
    if (!this.isEnabled || !this.client) {
      throw new Error('OpenAI TTS service is not configured. Set OPENAI_API_KEY in your environment variables or configure OpenRouter API key in settings.');
    }

    if (userId) {
      console.log(`✅ [TTS Service] Using OpenAI API key from environment variables (NOT user's OpenRouter key)`);
      console.log(`🔒 [TTS Service] Note: TTS may not be available through OpenRouter, using direct OpenAI access`);
    }

    try {
      console.log(`🎙️  Starting OpenAI TTS generation - Length: ${text.length} chars, Voice: ${voice}, Model: ${model}`);

      // Split text into chunks
      const chunks = this.splitIntoChunks(text);
      console.log(`📋 Split into ${chunks.length} chunks`);

      // Generate audio for each chunk
      const audioBuffers: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkBuffer = await this.generateChunkAudio(chunks[i], voice, model, i);
        audioBuffers.push(chunkBuffer);
      }

      // If only one chunk, return it directly
      let finalBuffer: Buffer;
      if (audioBuffers.length === 1) {
        finalBuffer = audioBuffers[0];
        console.log(`✅ Single chunk audio generated - Size: ${finalBuffer.length} bytes`);
      } else {
        // Concatenate multiple chunks
        finalBuffer = await this.concatenateAudioFiles(audioBuffers);
      }

      // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
      const estimatedWords = text.length / 5;
      const estimatedDuration = (estimatedWords / 150) * 60;

      console.log(`✅ OpenAI TTS generation complete - Total size: ${finalBuffer.length} bytes, Est. duration: ${estimatedDuration.toFixed(1)}s`);

      return {
        audioBuffer: finalBuffer,
        duration: estimatedDuration,
        format: 'mp3',
      };

    } catch (error) {
      console.error('❌ Error generating audio with OpenAI TTS:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('insufficient_quota')) {
          throw new Error('OpenAI API quota exceeded. Please check your billing settings.');
        }
        throw new Error(`Failed to generate audio: ${error.message}`);
      }
      
      throw new Error('Failed to generate audio: Unknown error');
    }
  }

  /**
   * Get estimated cost for text
   */
  estimateCost(textLength: number, model: 'tts-1' | 'tts-1-hd' = 'tts-1'): number {
    // Pricing: tts-1 = $0.015/1K chars, tts-1-hd = $0.030/1K chars
    const pricePerK = model === 'tts-1' ? 0.015 : 0.030;
    return (textLength / 1000) * pricePerK;
  }
}

// Export singleton instance
export const openaiTTSService = new OpenAITTSService();

