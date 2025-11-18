/**
 * Unified LLM Service
 * Switches between OpenAI (production), Ollama (development), and OpenRouter (user-configured) based on NODE_ENV and user settings
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { decrypt, maskApiKey } from './encryption.service';
import { OpenRouterService } from './openrouter.service';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  thinking_mode?: boolean; // Enable thinking mode for better reasoning
  userId?: string; // Optional user ID to check for OpenRouter config
  useOpenRouter?: boolean; // Force use OpenRouter if available
  taskType?: 'default' | 'research' | 'suggestions'; // Task type to determine which temperature to use
}

export class LLMService {
  private openai?: OpenAI;
  private isLocal: boolean;
  private localEndpoint: string;
  private defaultModel: string;

  constructor() {
    // Use OpenAI if API key is available, otherwise use local Ollama
    this.isLocal = !process.env.OPENAI_API_KEY;
    this.localEndpoint = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    
    if (this.isLocal) {
      // Use local Ollama
      this.defaultModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
      console.log('🦙 LLM Service: Using local Ollama at', this.localEndpoint);
      console.log('🎯 Default model:', this.defaultModel);
    } else {
      // Use OpenAI
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.defaultModel = 'gpt-4';
      console.log('🤖 LLM Service: Using OpenAI GPT-4');
    }
  }

  async chatCompletion(
    messages: LLMMessage[], 
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const {
      model,
      temperature: providedTemperature,
      max_tokens = 8000, // Increased from 2000 to leverage larger context windows (GPT-4 Turbo: 128K, Claude 3.5: 200K)
      system_prompt,
      thinking_mode = false,
      userId,
      useOpenRouter = true,
      taskType = 'default'
    } = options;

    // Get user's temperature preference if userId is provided and temperature not explicitly set
    let temperature = providedTemperature;
    if (!providedTemperature && userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            defaultModelTemperature: true,
            researchModelTemperature: true,
            suggestionsModelTemperature: true,
          },
        });

        if (user) {
          switch (taskType) {
            case 'research':
              temperature = user.researchModelTemperature ?? 0.3;
              break;
            case 'suggestions':
              temperature = user.suggestionsModelTemperature ?? 0.8;
              break;
            case 'default':
            default:
              temperature = user.defaultModelTemperature ?? 0.7;
              break;
          }
          console.log(`🌡️  [LLM Service] Using user's ${taskType} temperature: ${temperature}`);
        }
      } catch (error) {
        console.error('Error fetching user temperature settings:', error);
        // Fall back to defaults
        temperature = taskType === 'research' ? 0.3 : taskType === 'suggestions' ? 0.8 : 0.7;
      }
    } else if (!providedTemperature) {
      // Default temperatures if no userId
      temperature = taskType === 'research' ? 0.3 : taskType === 'suggestions' ? 0.8 : 0.7;
    }

    // Add system prompt if provided and not already present
    if (system_prompt && !messages.find(m => m.role === 'system')) {
      messages = [{ role: 'system', content: system_prompt }, ...messages];
    }

    // Track if OpenRouter was attempted
    let openRouterAttempted = false;
    let openRouterHadKey = false;

    // Check for OpenRouter configuration if user ID is provided
    if (useOpenRouter && userId) {
      openRouterAttempted = true;
      try {
        console.log(`🔍 [LLM Service] Checking for user's OpenRouter API key in database (userId: ${userId})`);
        console.log(`🔍 [LLM Service] NOT checking environment variables - using user's database-stored key only`);
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            openRouterApiKey: true,
            openRouterDefaultModel: true,
            openRouterResearchModel: true,
            openRouterSuggestionsModel: true,
            defaultModelTemperature: true,
            researchModelTemperature: true,
            suggestionsModelTemperature: true,
          },
        });

        if (user?.openRouterApiKey) {
          openRouterHadKey = true;
          try {
            const apiKey = decrypt(user.openRouterApiKey);
            const maskedKey = maskApiKey(apiKey);
            
            console.log(`✅ [LLM Service] Found user's OpenRouter API key in database: ${maskedKey}`);
            console.log(`✅ [LLM Service] Using USER'S API KEY from database (NOT env variables)`);
            console.log(`🔒 [LLM Service] Environment OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'EXISTS but NOT USED' : 'NOT SET (as expected)'}`);
            
            const openRouterService = new OpenRouterService(apiKey);
            
            // Use user's preferred model based on task type or the specified model
            let selectedModel = model;
            if (!selectedModel) {
              switch (taskType) {
                case 'research':
                  selectedModel = user.openRouterResearchModel || user.openRouterDefaultModel || 'openai/gpt-4';
                  break;
                case 'suggestions':
                  selectedModel = user.openRouterSuggestionsModel || user.openRouterDefaultModel || 'openai/gpt-4';
                  break;
                case 'default':
                default:
                  selectedModel = user.openRouterDefaultModel || 'openai/gpt-4';
                  break;
              }
            }
            
            console.log(`🌐 Using OpenRouter with model: ${selectedModel} (taskType: ${taskType})`);
            
            const response = await openRouterService.chatCompletion(messages, {
              model: selectedModel,
              temperature,
              max_tokens,
            });

            return {
              content: response.content,
              model: response.model,
              usage: response.usage,
            };
          } catch (openRouterError) {
            console.error('OpenRouter API error:', openRouterError);
            // Fall through to default behavior - will handle below
          }
        } else {
          console.log(`ℹ️  [LLM Service] No OpenRouter API key found in user's database record (userId: ${userId})`);
          console.log(`ℹ️  [LLM Service] Falling back to default LLM (OpenAI/Ollama from env)`);
        }
      } catch (error) {
        console.error('Error checking OpenRouter config, falling back to default:', error);
        // Fall through to default behavior
      }
    }

    // Default behavior: use OpenAI or Ollama
    const selectedModel = model || this.defaultModel;

    // If user has OpenRouter configured but it failed, don't silently fall back to Ollama
    // Instead, try OpenAI if available, or give a clear error
    if (openRouterAttempted && openRouterHadKey) {
      // User has OpenRouter configured but it failed - try OpenAI as fallback
      if (process.env.OPENAI_API_KEY) {
        console.log('⚠️  OpenRouter failed, falling back to OpenAI');
        return await this.callOpenAI(messages, { 
          model: selectedModel, 
          temperature: temperature ?? 0.7, 
          max_tokens: max_tokens ?? 8000 
        });
      } else {
        throw new Error('OpenRouter is configured but failed. Please check your API key in settings or configure OpenAI API key in environment variables.');
      }
    }

    // Normal fallback: OpenAI or Ollama
    if (this.isLocal) {
      return await this.callOllama(messages, { 
        model: selectedModel, 
        temperature: temperature ?? 0.7, 
        max_tokens: max_tokens ?? 8000, 
        thinking_mode 
      });
    } else {
      return await this.callOpenAI(messages, { 
        model: selectedModel, 
        temperature: temperature ?? 0.7, 
        max_tokens: max_tokens ?? 8000 
      });
    }
  }

  private async callOllama(
    messages: LLMMessage[], 
    options: { model: string; temperature: number; max_tokens: number; thinking_mode: boolean }
  ): Promise<LLMResponse> {
    try {
      // Qwen3 Optimal Settings (from best practices)
      // Thinking mode: temp=0.6, top_p=0.95, top_k=20, presence_penalty=1.5
      // Non-thinking mode: temp=0.7, top_p=0.8, top_k=20, presence_penalty=1.5
      const thinkingParams = {
        temperature: 0.6,
        top_p: 0.95,
        top_k: 20,
        mirostat: 0, // MinP equivalent
        repeat_penalty: 1.5, // PresencePenalty equivalent
      };

      const normalParams = {
        temperature: 0.7,
        top_p: 0.8,
        top_k: 20,
        mirostat: 0, // MinP equivalent
        repeat_penalty: 1.5, // PresencePenalty equivalent
      };

      const ollamaParams = options.thinking_mode ? thinkingParams : normalParams;

      const response = await fetch(`${this.localEndpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: messages,
          stream: false,
          options: {
            ...ollamaParams,
            num_predict: options.max_tokens,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.message?.content || '',
        model: options.model,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        }
      };
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Failed to get response from Ollama: ${error}`);
    }
  }

  private async callOpenAI(
    messages: LLMMessage[], 
    options: { model: string; temperature: number; max_tokens: number }
  ): Promise<LLMResponse> {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.chat.completions.create({
        model: options.model,
        messages: messages as any,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        model: options.model,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        }
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to get AI response from OpenAI');
    }
  }

  /**
   * Check if local Ollama is available
   */
  async checkOllamaAvailability(): Promise<boolean> {
    if (!this.isLocal) return false;
    
    try {
      const response = await fetch(`${this.localEndpoint}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available models (useful for debugging)
   */
  async getAvailableModels(): Promise<string[]> {
    if (this.isLocal) {
      try {
        const response = await fetch(`${this.localEndpoint}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          return data.models?.map((m: any) => m.name) || [];
        }
      } catch (error) {
        console.error('Error fetching Ollama models:', error);
      }
      return [];
    } else {
      return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
    }
  }

  /**
   * Get service info for debugging
   */
  getServiceInfo() {
    return {
      isLocal: this.isLocal,
      endpoint: this.isLocal ? this.localEndpoint : 'OpenAI API',
      defaultModel: this.defaultModel,
      environment: process.env.NODE_ENV,
    };
  }
}

// Singleton instance
export const llmService = new LLMService();
