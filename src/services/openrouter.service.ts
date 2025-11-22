/**
 * OpenRouter Service
 * Handles API calls to OpenRouter for accessing multiple AI models
 */

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChatOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface OpenRouterChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  pricing?: {
    prompt: string;
    completion: string;
  };
  // Output modalities for image generation support
  output_modalities?: string[];
}

export class OpenRouterService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Test if the API key is valid
   */
  async testApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('OpenRouter API key test failed:', error);
      return false;
    }
  }

  /**
   * Fetch available models from OpenRouter
   */
  async getAvailableModels(): Promise<OpenRouterModel[]> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.data || [];
      
      // Log model structure for debugging
      if (models.length > 0) {
        console.log(`📋 Sample model structure:`, {
          id: models[0].id,
          name: models[0].name,
          output_modalities: models[0].output_modalities,
          architecture: models[0].architecture,
        });
      }
      
      return models;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      throw new Error('Failed to fetch available models from OpenRouter');
    }
  }

  /**
   * Get a specific model's information including context_length
   */
  async getModelInfo(modelId: string): Promise<OpenRouterModel | null> {
    try {
      const models = await this.getAvailableModels();
      return models.find(m => m.id === modelId) || null;
    } catch (error) {
      console.error('Error fetching model info:', error);
      return null;
    }
  }

  /**
   * Extract embedding dimensions from model description or ID
   * Returns null if dimensions cannot be determined
   */
  private getEmbeddingDimensions(model: OpenRouterModel): number | null {
    // Check description first (e.g., "1536 dimensions" or "3072 dimensions")
    const desc = model.description?.toLowerCase() || '';
    const descMatch = desc.match(/(\d+)\s*dimensions?/);
    if (descMatch) {
      return parseInt(descMatch[1], 10);
    }
    
    // Check model ID for known patterns
    const id = model.id?.toLowerCase() || '';
    
    // Known 1536-dimension models
    if (
      id.includes('ada-002') ||
      id.includes('text-embedding-3-small') ||
      id.includes('embedding-3-small')
    ) {
      return 1536;
    }
    
    // Known 3072-dimension models (we filter these out)
    if (
      id.includes('text-embedding-3-large') ||
      id.includes('embedding-3-large')
    ) {
      return 3072;
    }
    
    // Default to 1536 for unknown embedding models (safer assumption)
    // But return null to be explicit that we couldn't determine
    return null;
  }

  /**
   * Get embedding models specifically
   * OpenRouter supports OpenAI embedding models through their API
   * Only includes models with 1536 dimensions (required for our vector store)
   */
  async getEmbeddingModels(): Promise<OpenRouterModel[]> {
    const allModels = await this.getAvailableModels();
    
    // Filter for embedding models from OpenRouter's list
    const foundEmbeddingModels = allModels.filter(model => {
      const id = model.id?.toLowerCase() || '';
      const modality = model.architecture?.modality?.toLowerCase() || '';
      return (
        modality === 'embeddings' ||
        id.includes('embedding') ||
        id.includes('embed') ||
        id.includes('text-embedding')
      );
    });
    
    // Always include common OpenAI embedding models with 1536 dimensions (they work through OpenRouter)
    const defaultEmbeddingModels: OpenRouterModel[] = [
      {
        id: 'openai/text-embedding-ada-002',
        name: 'OpenAI Text Embedding Ada 002',
        description: 'OpenAI\'s standard embedding model (1536 dimensions)',
        context_length: 8191,
      },
      {
        id: 'openai/text-embedding-3-small',
        name: 'OpenAI Text Embedding 3 Small',
        description: 'OpenAI\'s newer small embedding model (1536 dimensions)',
        context_length: 8191,
      },
      // Note: text-embedding-3-large (3072 dimensions) is excluded as we only support 1536 dimensions
    ];
    
    // Combine found models with defaults, removing duplicates
    const allEmbeddingModels = [...foundEmbeddingModels];
    const existingIds = new Set(allEmbeddingModels.map(m => m.id));
    
    // Add default models if they're not already present
    for (const model of defaultEmbeddingModels) {
      if (!existingIds.has(model.id)) {
        allEmbeddingModels.push(model);
        existingIds.add(model.id);
      }
    }
    
    // Filter to only include models with 1536 dimensions
    const filteredModels = allEmbeddingModels.filter(model => {
      const dimensions = this.getEmbeddingDimensions(model);
      // Include models with 1536 dimensions, or unknown dimensions (assume 1536 for safety)
      // Explicitly exclude 3072-dimension models
      return dimensions === null || dimensions === 1536;
    });
    
    return filteredModels;
  }

  /**
   * Get chat/completion models
   * Excludes embedding models and includes all other models
   */
  async getChatModels(): Promise<OpenRouterModel[]> {
    const allModels = await this.getAvailableModels();
    return allModels.filter(model => {
      const id = model.id?.toLowerCase() || '';
      const modality = model.architecture?.modality?.toLowerCase() || '';
      
      // Exclude embedding models
      if (
        modality === 'embeddings' ||
        id.includes('embedding') ||
        id.includes('embed') ||
        id.includes('text-embedding')
      ) {
        return false;
      }
      
      // Exclude TTS models
      if (
        id.includes('tts') ||
        id.includes('text-to-speech') ||
        modality === 'audio' ||
        id.includes('speech')
      ) {
        return false;
      }
      
      // Include all other models (most models are chat/completion models)
      return true;
    });
  }

  /**
   * Get TTS (text-to-speech) models
   * Filters for models that support text-to-speech/audio generation
   */
  async getTTSModels(): Promise<OpenRouterModel[]> {
    const allModels = await this.getAvailableModels();
    return allModels.filter(model => {
      const id = model.id?.toLowerCase() || '';
      const modality = model.architecture?.modality?.toLowerCase() || '';
      const name = model.name?.toLowerCase() || '';
      
      // Include TTS models
      if (
        id.includes('tts') ||
        id.includes('text-to-speech') ||
        modality === 'audio' ||
        id.includes('speech') ||
        name.includes('tts') ||
        name.includes('text-to-speech')
      ) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Get STT (speech-to-text) models
   * Filters for models that support speech-to-text/audio transcription (Whisper models)
   */
  async getSTTModels(): Promise<OpenRouterModel[]> {
    const allModels = await this.getAvailableModels();
    return allModels.filter(model => {
      const id = model.id?.toLowerCase() || '';
      const name = model.name?.toLowerCase() || '';
      
      // Include Whisper models (OpenRouter typically uses openai/whisper-* format)
      if (
        id.includes('whisper') ||
        name.includes('whisper') ||
        id.includes('stt') ||
        name.includes('speech-to-text')
      ) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Get image generation models
   * Returns all available models from OpenRouter (no filtering)
   */
  async getImageModels(): Promise<OpenRouterModel[]> {
    const allModels = await this.getAvailableModels();
    
    console.log(`📸 Returning all ${allModels.length} models for image generation selection`);
    
    return allModels;
  }

  /**
   * Chat completion using OpenRouter
   */
  async chatCompletion(
    messages: OpenRouterMessage[],
    options: OpenRouterChatOptions
  ): Promise<{
    content: string;
    model: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
          'X-Title': 'Rogan Writer',
        },
        body: JSON.stringify({
          model: options.model,
          messages: messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 8000, // Increased default from 2000 to leverage larger context windows
          top_p: options.top_p,
          frequency_penalty: options.frequency_penalty,
          presence_penalty: options.presence_penalty,
        }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const responseText = await response.text();
          if (responseText) {
            errorData = JSON.parse(responseText);
          }
        } catch (e) {
          // If JSON parsing fails, use status text as error message
          errorData = { error: { message: response.statusText || 'Unknown error' } };
        }
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}. ${errorData.error?.message || errorData.message || ''}`
        );
      }

      // Get response as text first to check if it's valid JSON
      const responseText = await response.text();
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from OpenRouter API');
      }

      let data: OpenRouterChatResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse OpenRouter response:', {
          status: response.status,
          statusText: response.statusText,
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 500),
        });
        throw new Error(`Invalid JSON response from OpenRouter: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices from OpenRouter');
      }

      return {
        content: data.choices[0].message.content || '',
        model: data.model,
        usage: data.usage,
      };
    } catch (error) {
      console.error('OpenRouter chat completion error:', error);
      throw new Error(`Failed to get response from OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate text-to-speech audio using OpenRouter (if supported)
   * Note: OpenRouter may proxy OpenAI TTS requests
   */
  async generateTTS(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy',
    model: 'tts-1' | 'tts-1-hd' = 'tts-1'
  ): Promise<{
    audioBuffer: Buffer;
    model: string;
  }> {
    try {
      // Try OpenAI TTS through OpenRouter proxy
      // OpenRouter may support this via their OpenAI proxy
      const response = await fetch(`${this.baseURL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
          'X-Title': 'Rogan Writer',
        },
        body: JSON.stringify({
          model: `openai/${model}`,
          voice: voice,
          input: text,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        // If OpenRouter doesn't support TTS, throw error to fall back to direct OpenAI
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter TTS API error: ${response.status} ${response.statusText}. ${errorData.error?.message || 'TTS not supported via OpenRouter'}`
        );
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      return {
        audioBuffer,
        model: `openai/${model}`,
      };
    } catch (error) {
      console.error('OpenRouter TTS generation error:', error);
      throw new Error(`Failed to generate TTS via OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio using OpenRouter
   * Supports both Whisper models (via audio/transcriptions) and multimodal models (via chat completions)
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    model: string = 'openai/whisper-1',
    language?: string,
    prompt?: string,
    temperature?: number
  ): Promise<{
    transcript: string;
    language?: string;
    model: string;
  }> {
    try {
      const isWhisperModel = model.toLowerCase().includes('whisper');
      
      if (isWhisperModel) {
        // Use audio/transcriptions endpoint for Whisper models
        const uint8Array = new Uint8Array(audioBuffer);
        const audioBlob = new Blob([uint8Array], { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
        
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('model', model);
        
        if (language) {
          formData.append('language', language.substring(0, 2));
        }
        if (prompt) {
          formData.append('prompt', prompt);
        }
        formData.append('temperature', (temperature ?? 0.2).toString());
        formData.append('response_format', 'json');
        
        const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
            'X-Title': 'Rogan Writer',
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `OpenRouter STT API error: ${response.status} ${response.statusText}. ${errorData.error?.message || 'STT not supported via OpenRouter'}`
          );
        }

        const data = await response.json();
        
        return {
          transcript: data.text || data.transcript || '',
          language: data.language || language,
          model: model,
        };
      } else {
        // Use chat completions with multimodal audio input for other models (e.g., Gemini)
        // Convert audio to base64 (without data URL prefix for OpenRouter)
        const base64Audio = audioBuffer.toString('base64');
        // Try wav format first (more widely supported), fallback to webm
        const audioFormat = 'wav'; // wav is more widely supported than webm
        
        // Use a clear, direct prompt
        const transcriptionPrompt = prompt || (language ? `Transcribe this ${language} audio file to text.` : 'Transcribe this audio file to text.');
        
        // OpenRouter uses OpenAI-compatible multimodal format
        // Format: content array with input_audio type
        // The order might matter - try audio first, then text
        const messages: any[] = [{
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio, // Base64 string without data URL prefix
                format: audioFormat
              }
            },
            {
              type: 'text',
              text: transcriptionPrompt
            }
          ]
        }];
        
        console.log(`🎤 [STT] Attempting transcription with model: ${model} using chat completions`);
        console.log(`📊 [STT] Audio size: ${audioBuffer.length} bytes, format: ${audioFormat}, base64 length: ${base64Audio.length}`);
        
        // Try first without modalities
        let requestBody: any = {
          model: model,
          messages: messages,
          temperature: temperature ?? 0.2,
        };
        
        let response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
            'X-Title': 'Rogan Writer',
          },
          body: JSON.stringify(requestBody),
        });

        // If that fails, try with modalities parameter (like image generation)
        if (!response.ok) {
          console.log(`⚠️  [STT] First attempt failed, trying with modalities parameter`);
          requestBody.modalities = ['audio', 'text'];
          
          response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
              'X-Title': 'Rogan Writer',
            },
            body: JSON.stringify(requestBody),
          });
        }
        
        // If still failing, try with webm format
        if (!response.ok) {
          console.log(`⚠️  [STT] Trying with webm format instead of wav`);
          messages[0].content[0].input_audio.format = 'webm';
          requestBody.messages = messages;
          delete requestBody.modalities; // Remove modalities for this attempt
          
          response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
              'X-Title': 'Rogan Writer',
            },
            body: JSON.stringify(requestBody),
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorData: any = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: { message: errorText } };
          }
          
          console.error('OpenRouter chat completions error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            model: model,
            requestBody: JSON.stringify(requestBody).substring(0, 500) // Log first 500 chars
          });
          
          throw new Error(
            `OpenRouter STT API error: ${response.status} ${response.statusText}. ${errorData.error?.message || `Audio transcription may not be supported for model ${model}. Try a Whisper model like openai/whisper-1.`}`
          );
        }

        const data: OpenRouterChatResponse = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
          throw new Error('No response from model');
        }

        const transcript = data.choices[0].message.content || '';
        
        if (!transcript || !transcript.trim()) {
          throw new Error('Empty transcription response from model');
        }
        
        return {
          transcript: transcript.trim(),
          language: language,
          model: data.model || model,
        };
      }
    } catch (error) {
      console.error('OpenRouter audio transcription error:', error);
      throw new Error(`Failed to transcribe audio via OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings using OpenRouter
   */
  async generateEmbedding(
    text: string,
    model: string
  ): Promise<{
    embedding: number[];
    model: string;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
    };
  }> {
    try {
      const cleanText = text.slice(0, 8000).trim();
      
      if (!cleanText) {
        throw new Error('Text is empty or too short for embedding generation');
      }

      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
          'X-Title': 'Rogan Writer',
        },
        body: JSON.stringify({
          model: model,
          input: cleanText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter embeddings API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
        );
      }

      const data: OpenRouterEmbeddingResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data returned from OpenRouter');
      }

      return {
        embedding: data.data[0].embedding,
        model: data.model,
        usage: data.usage,
      };
    } catch (error) {
      console.error('OpenRouter embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

