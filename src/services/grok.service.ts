/**
 * Grok AI Service
 * Integrates with X.AI's Grok API for advanced editing capabilities
 * Uses the grok-4-fast-non-reasoning model with massive context window
 * Supports both direct X.AI API and OpenRouter (if user has configured it)
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { decrypt, maskApiKey } from './encryption.service';
import { OpenRouterService } from './openrouter.service';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokChatOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  model?: string;
  userId?: string; // Optional user ID to check for OpenRouter config
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
  private client: OpenAI | null = null;
  private defaultModel: string = 'grok-4-fast-non-reasoning';
  private isInitialized: boolean = false;

  /**
   * Lazy initialization - only create client when actually needed
   */
  private initialize() {
    if (this.isInitialized && this.client) {
      return;
    }

    const apiKey = process.env.XAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('XAI_API_KEY is not configured in environment variables');
    }

    // X.AI uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    });

    this.isInitialized = true;
    console.log('🤖 Grok Service initialized with default model:', this.defaultModel);
  }

  /**
   * Send a chat completion request to Grok
   * Checks for user's OpenRouter API key first, falls back to direct X.AI API
   */
  async chatCompletion(
    messages: GrokMessage[],
    options: GrokChatOptions = {}
  ): Promise<GrokResponse> {
    const {
      temperature: providedTemperature,
      max_tokens = 16000, // Increased from 4000 - Grok 4 Fast supports 2M token context, Grok 4 supports 256K
      stream = false,
      model = this.defaultModel,
      userId,
    } = options;

    // Get user's default temperature if userId is provided and temperature not explicitly set
    let temperature = providedTemperature;
    if (!providedTemperature && userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            defaultModelTemperature: true,
          },
        });
        if (user?.defaultModelTemperature !== null && user?.defaultModelTemperature !== undefined) {
          temperature = user.defaultModelTemperature;
          console.log(`🌡️  [Grok Service] Using user's default temperature: ${temperature}`);
        } else {
          temperature = 0.7; // Default
        }
      } catch (error) {
        console.error('Error fetching user temperature settings:', error);
        temperature = 0.7; // Default
      }
    } else if (!providedTemperature) {
      temperature = 0.7; // Default
    }

    // Check for OpenRouter configuration if user ID is provided
    if (userId) {
      try {
        console.log(`🔍 [Grok Service] Checking for user's OpenRouter API key in database (userId: ${userId})`);
        console.log(`🔍 [Grok Service] NOT checking environment variables - using user's database-stored key only`);
        
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
            
            console.log(`✅ [Grok Service] Found user's OpenRouter API key in database: ${maskedKey}`);
            console.log(`✅ [Grok Service] Using USER'S API KEY from database (NOT env variables)`);
            console.log(`🔒 [Grok Service] Environment XAI_API_KEY: ${process.env.XAI_API_KEY ? 'EXISTS but NOT USED' : 'NOT SET (as expected)'}`);
            
            // Map Grok model names to OpenRouter format
            // OpenRouter uses: x-ai/grok-4-fast-non-reasoning, x-ai/grok-4-fast-reasoning
            const openRouterModel = model.startsWith('grok-') 
              ? `x-ai/${model}` 
              : `x-ai/grok-4-fast-non-reasoning`;
            
            console.log(`🌐 [Grok Service] Using OpenRouter with model: ${openRouterModel}`);
            
            const openRouterService = new OpenRouterService(apiKey);
            const response = await openRouterService.chatCompletion(
              messages.map(m => ({ role: m.role, content: m.content })),
              {
                model: openRouterModel,
                temperature,
                max_tokens,
              }
            );

            return {
              content: response.content,
              usage: response.usage,
            };
          } catch (openRouterError) {
            console.error('OpenRouter API error for Grok:', openRouterError);
            console.log(`ℹ️  [Grok Service] Falling back to direct X.AI API`);
            // Fall through to direct X.AI API
          }
        } else {
          console.log(`ℹ️  [Grok Service] No OpenRouter API key found in user's database record (userId: ${userId})`);
          console.log(`ℹ️  [Grok Service] Falling back to direct X.AI API from env`);
        }
      } catch (error) {
        console.error('Error checking OpenRouter config for Grok, falling back to X.AI:', error);
        // Fall through to direct X.AI API
      }
    }

    // Fall back to direct X.AI API
    this.initialize(); // Lazy initialization
    
    if (!this.client) {
      throw new Error('Grok service not configured. Set XAI_API_KEY in your environment variables or configure OpenRouter API key in settings.');
    }

    if (userId) {
      console.log(`✅ [Grok Service] Using X.AI API key from environment variables (NOT user's OpenRouter key)`);
      console.log(`🔒 [Grok Service] Environment XAI_API_KEY: ${process.env.XAI_API_KEY ? 'EXISTS' : 'NOT SET'}`);
    }

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
   * Checks for user's OpenRouter API key first, falls back to direct X.AI API
   */
  async streamChatCompletion(
    messages: GrokMessage[],
    onChunk: (chunk: string) => void,
    options: GrokChatOptions = {}
  ): Promise<void> {
    const {
      temperature: providedTemperature,
      max_tokens = 16000, // Increased from 4000 - Grok 4 Fast supports 2M token context, Grok 4 supports 256K
      model = this.defaultModel,
      userId,
    } = options;

    // Get user's default temperature if userId is provided and temperature not explicitly set
    let temperature = providedTemperature;
    if (!providedTemperature && userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            defaultModelTemperature: true,
          },
        });
        if (user?.defaultModelTemperature !== null && user?.defaultModelTemperature !== undefined) {
          temperature = user.defaultModelTemperature;
          console.log(`🌡️  [Grok Service] Using user's default temperature for streaming: ${temperature}`);
        } else {
          temperature = 0.7; // Default
        }
      } catch (error) {
        console.error('Error fetching user temperature settings:', error);
        temperature = 0.7; // Default
      }
    } else if (!providedTemperature) {
      temperature = 0.7; // Default
    }

    // Check for OpenRouter configuration if user ID is provided
    if (userId) {
      try {
        console.log(`🔍 [Grok Service] Checking for user's OpenRouter API key in database (userId: ${userId})`);
        
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
            
            console.log(`✅ [Grok Service] Found user's OpenRouter API key in database: ${maskedKey}`);
            console.log(`✅ [Grok Service] Using USER'S API KEY from database via OpenRouter for streaming`);
            
            // Map Grok model names to OpenRouter format
            const openRouterModel = model.startsWith('grok-') 
              ? `x-ai/${model}` 
              : `x-ai/grok-4-fast-non-reasoning`;
            
            console.log(`🌐 [Grok Service] Streaming via OpenRouter with model: ${openRouterModel}`);
            
            const openRouterService = new OpenRouterService(apiKey);
            
            // Note: OpenRouterService doesn't currently support streaming
            // For streaming requests, we fall back to direct X.AI API
            // Non-streaming requests will use OpenRouter if user has configured it
            console.log(`ℹ️  [Grok Service] Streaming not yet supported via OpenRouter, falling back to direct X.AI API`);
            // Fall through to direct X.AI API for streaming
          } catch (openRouterError) {
            console.error('OpenRouter API error for Grok streaming:', openRouterError);
            // Fall through to direct X.AI API
          }
        }
      } catch (error) {
        console.error('Error checking OpenRouter config for Grok streaming:', error);
        // Fall through to direct X.AI API
      }
    }

    // Fall back to direct X.AI API for streaming
    this.initialize(); // Lazy initialization
    
    if (!this.client) {
      throw new Error('Grok service not configured. Set XAI_API_KEY in your environment variables or configure OpenRouter API key in settings.');
    }

    if (userId) {
      console.log(`✅ [Grok Service] Using X.AI API key from environment variables for streaming (NOT user's OpenRouter key)`);
    }

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

