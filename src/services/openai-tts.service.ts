/**
 * OpenAI TTS Integration Service
 * Handles text-to-speech generation with automatic chunking for long content
 */

import OpenAI from 'openai';

interface GenerateAudioParams {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
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
    const apiKey = process.env.OPENAI_API_KEY;
    this.isEnabled = !!apiKey;

    if (this.isEnabled && apiKey) {
      this.client = new OpenAI({ apiKey });
      console.log(`🎙️  OpenAI TTS Service initialized - Model: tts-1 (cheapest)`);
    } else {
      console.log(`⚠️  OpenAI TTS Service disabled - No OPENAI_API_KEY configured`);
    }
  }

  /**
   * Check if OpenAI TTS service is available
   */
  async healthCheck(): Promise<boolean> {
    return this.isEnabled && this.client !== null;
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
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    console.log(`🎙️  Generating chunk ${chunkIndex + 1} (${text.length} chars)...`);

    const response = await this.client.audio.speech.create({
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
   */
  async generateAudio(params: GenerateAudioParams): Promise<TTSResponse> {
    if (!this.isEnabled || !this.client) {
      throw new Error('OpenAI TTS service is not configured. Set OPENAI_API_KEY in your environment variables.');
    }

    const { text, voice = 'alloy', model = 'tts-1' } = params;

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

