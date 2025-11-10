/**
 * Unified LLM Service
 * Switches between OpenAI (production) and Ollama (development) based on NODE_ENV
 */

import OpenAI from 'openai';

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
      model = this.defaultModel,
      temperature = 0.7,
      max_tokens = 2000,
      system_prompt,
      thinking_mode = false
    } = options;

    // Add system prompt if provided and not already present
    if (system_prompt && !messages.find(m => m.role === 'system')) {
      messages = [{ role: 'system', content: system_prompt }, ...messages];
    }

    if (this.isLocal) {
      return await this.callOllama(messages, { model, temperature, max_tokens, thinking_mode });
    } else {
      return await this.callOpenAI(messages, { model, temperature, max_tokens });
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
