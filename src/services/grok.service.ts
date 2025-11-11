/**
 * Grok AI Service
 * Integrates with X.AI's Grok API for advanced editing capabilities
 * Uses the grok-4-fast-non-reasoning model with massive context window
 */

import OpenAI from 'openai';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokChatOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  model?: string;
}

interface GrokResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GrokService {
  private client: OpenAI;
  private defaultModel: string = 'grok-4-fast-non-reasoning';

  constructor() {
    const apiKey = process.env.XAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('XAI_API_KEY is not configured in environment variables');
    }

    // X.AI uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    });

    console.log('🤖 Grok Service initialized with default model:', this.defaultModel);
  }

  /**
   * Send a chat completion request to Grok
   */
  async chatCompletion(
    messages: GrokMessage[],
    options: GrokChatOptions = {}
  ): Promise<GrokResponse> {
    const {
      temperature = 0.7,
      max_tokens = 4000,
      stream = false,
      model = this.defaultModel,
    } = options;

    try {
      console.log(`📤 Grok API request with ${messages.length} messages using model: ${model}`);
      
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        temperature,
        max_tokens,
        stream: false, // Always false for non-streaming
      });

      const content = completion.choices[0]?.message?.content || '';
      
      console.log(`📥 Grok API response: ${content.length} characters`);
      
      return {
        content,
        usage: completion.usage ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        } : undefined,
      };
    } catch (error: any) {
      console.error('❌ Grok API error:', error);
      
      if (error.status === 401) {
        throw new Error('Invalid X.AI API key. Please check your XAI_API_KEY environment variable.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.status === 500) {
        throw new Error('Grok API server error. Please try again later.');
      }
      
      throw new Error(`Grok API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Stream a chat completion response from Grok
   * Useful for real-time editor feedback
   */
  async streamChatCompletion(
    messages: GrokMessage[],
    onChunk: (chunk: string) => void,
    options: GrokChatOptions = {}
  ): Promise<void> {
    const {
      temperature = 0.7,
      max_tokens = 4000,
      model = this.defaultModel,
    } = options;

    try {
      console.log(`📤 Grok streaming request with ${messages.length} messages using model: ${model}`);
      
      const stream = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        temperature,
        max_tokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }
      
      console.log('✅ Grok streaming completed');
    } catch (error: any) {
      console.error('❌ Grok streaming error:', error);
      throw new Error(`Grok streaming error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get service information
   */
  getServiceInfo() {
    return {
      defaultModel: this.defaultModel,
      availableModels: ['grok-4-fast-non-reasoning', 'grok-4-fast-reasoning'],
      provider: 'X.AI',
      isConfigured: !!process.env.XAI_API_KEY,
    };
  }
}

// Singleton instance
export const grokService = new GrokService();

