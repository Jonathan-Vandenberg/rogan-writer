/**
 * Unified LLM Service
 * Uses OpenRouter only - API keys come from user settings
 */

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
  agentType?: string; // Agent type (e.g., 'editor', 'default', 'research', 'suggestions') to load model preferences
}

export class LLMService {
  private defaultModel: string;

  constructor() {
    // OpenRouter is the only LLM service - API keys come from user settings only
    this.defaultModel = 'gpt-4'; // Default model name for OpenRouter
    console.log('🌐 LLM Service: Using OpenRouter (API keys from user settings only)');
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
      thinking_mode: providedThinkingMode = false,
      userId,
      useOpenRouter = true,
      taskType = 'default',
      agentType
    } = options;

    // Get user's temperature preference if userId is provided and temperature not explicitly set
    let temperature = providedTemperature;
    if (!providedTemperature && userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            editorModelTemperature: true,
            researchModelTemperature: true,
            suggestionsModelTemperature: true,
            chatModelTemperature: true,
          },
        });

        if (user) {
          // Use agentType if provided, otherwise use taskType
          const effectiveType = agentType || taskType;
          switch (effectiveType) {
            case 'editor':
              temperature = user.editorModelTemperature ?? 0.7;
              break;
            case 'research':
              temperature = user.researchModelTemperature ?? 0.3;
              break;
            case 'suggestions':
              temperature = user.suggestionsModelTemperature ?? 0.8;
              break;
            case 'chat':
              temperature = user.chatModelTemperature ?? 0.7;
              break;
            case 'default':
            default:
              temperature = user.chatModelTemperature ?? 0.7;
              break;
          }
          console.log(`🌡️  [LLM Service] Using user's ${effectiveType} temperature: ${temperature}`);
        }
      } catch (error) {
        console.error('Error fetching user temperature settings:', error);
        // Fall back to defaults
        const effectiveType = agentType || taskType;
        temperature = effectiveType === 'research' ? 0.3 : effectiveType === 'suggestions' ? 0.8 : 0.7;
      }
    } else if (!providedTemperature) {
      // Default temperatures if no userId
      const effectiveType = agentType || taskType;
      temperature = effectiveType === 'research' ? 0.3 : effectiveType === 'suggestions' ? 0.8 : 0.7;
    }

    // Add system prompt if provided and not already present
    if (system_prompt && !messages.find(m => m.role === 'system')) {
      messages = [{ role: 'system', content: system_prompt }, ...messages];
    }

    // Track if OpenRouter was attempted
    let openRouterAttempted = false;
    let openRouterHadKey = false;
    let openRouterError: Error | null = null;

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
            openRouterEditorModel: true,
            openRouterResearchModel: true,
            openRouterSuggestionsModel: true,
            openRouterChatModel: true,
            editorModelTemperature: true,
            researchModelTemperature: true,
            suggestionsModelTemperature: true,
            chatModelTemperature: true,
            modelPreferences: true,
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
            
            // Use user's preferred model based on agent type or task type
            let selectedModel = model;
            if (!selectedModel) {
              // Check agentType first, then fall back to taskType
              if (agentType === 'editor' && user.openRouterEditorModel) {
                selectedModel = user.openRouterEditorModel;
              } else if (agentType === 'chat' && user.openRouterChatModel) {
                selectedModel = user.openRouterChatModel;
              } else {
                switch (taskType) {
                  case 'research':
                    selectedModel = user.openRouterResearchModel || 'openai/gpt-4';
                    break;
                  case 'suggestions':
                    selectedModel = user.openRouterSuggestionsModel || 'openai/gpt-4';
                    break;
                  case 'default':
                  default:
                    // For default taskType, check if we have a chat model, otherwise use editor model
                    selectedModel = user.openRouterChatModel || user.openRouterEditorModel || 'openai/gpt-4';
                    break;
                }
              }
            }
            
            // Map taskType to agentType if agentType not provided (for backward compatibility)
            const effectiveAgentType = agentType || (taskType === 'research' ? 'research' : taskType === 'suggestions' ? 'suggestions' : 'chat');
            
            console.log(`🌐 Using OpenRouter with model: ${selectedModel} (taskType: ${taskType}, agentType: ${effectiveAgentType})`);
            
            // Load model preferences for this agent and model
            let thinkingMode = providedThinkingMode;
            let finalTemperature = temperature;
            
            if (effectiveAgentType && selectedModel && user.modelPreferences) {
              const preferences = user.modelPreferences as Record<string, Record<string, { thinking?: boolean; temperature?: number }>>;
              const agentPrefs = preferences[effectiveAgentType];
              if (agentPrefs && agentPrefs[selectedModel]) {
                const modelPrefs = agentPrefs[selectedModel];
                if (modelPrefs.thinking !== undefined) {
                  thinkingMode = modelPrefs.thinking;
                  console.log(`🧠 [LLM Service] Using saved thinking mode preference: ${thinkingMode} for ${effectiveAgentType}/${selectedModel}`);
                }
                if (modelPrefs.temperature !== undefined) {
                  finalTemperature = modelPrefs.temperature;
                  console.log(`🌡️  [LLM Service] Using saved temperature preference: ${finalTemperature} for ${effectiveAgentType}/${selectedModel}`);
                }
              }
            }
            
            // Get model info to determine optimal max_tokens based on context_length
            let optimalMaxTokens = max_tokens;
            try {
              const modelInfo = await openRouterService.getModelInfo(selectedModel);
              if (modelInfo?.context_length) {
                // Use up to 80% of context_length for output tokens, leaving 20% for input
                // But respect the requested max_tokens if it's explicitly set and lower
                const calculatedMax = Math.floor(modelInfo.context_length * 0.8);
                if (max_tokens) {
                  // If max_tokens is explicitly set, use the minimum of requested and calculated
                  optimalMaxTokens = Math.min(max_tokens, calculatedMax);
                } else {
                  // If max_tokens is not set, use the calculated value based on context_length
                  optimalMaxTokens = calculatedMax;
                }
                console.log(`📊 Model ${selectedModel} has context_length: ${modelInfo.context_length}, using max_tokens: ${optimalMaxTokens}${max_tokens ? ` (requested: ${max_tokens})` : ' (calculated from context_length)'}`);
              } else if (!max_tokens) {
                // If we can't get model info and no max_tokens specified, use a safe default
                optimalMaxTokens = 8000;
                console.log(`⚠️ Could not get model info for ${selectedModel}, using default max_tokens: ${optimalMaxTokens}`);
              }
            } catch (error) {
              console.warn(`Could not fetch model info for ${selectedModel}, using ${max_tokens || 'default'} max_tokens:`, error);
              if (!max_tokens) {
                optimalMaxTokens = 8000; // Fallback default
              }
            }
            
            // Build request options
            const requestOptions: any = {
              model: selectedModel,
              temperature: finalTemperature,
              max_tokens: optimalMaxTokens,
            };
            
            // Add thinking mode if supported and enabled
            // Note: OpenRouter may support this via model variants or parameters
            // For now, we'll pass it as a note in the system prompt if thinking mode is enabled
            if (thinkingMode) {
              // Some models support thinking mode via model name suffix or parameters
              // Check if model name suggests thinking support
              const modelLower = selectedModel.toLowerCase();
              if (modelLower.includes('reasoning') || modelLower.includes('thinking') || modelLower.includes('grok')) {
                console.log(`🧠 [LLM Service] Thinking mode enabled for model: ${selectedModel}`);
                // For Grok models, thinking mode might be handled via model selection
                // For other models, we might need to add it to the system prompt
                if (!messages.find(m => m.role === 'system' && m.content.includes('thinking'))) {
                  const thinkingPrompt = 'Use deep reasoning and thinking mode. Show your thought process when solving complex problems.';
                  if (system_prompt) {
                    messages = [{ role: 'system', content: `${system_prompt}\n\n${thinkingPrompt}` }, ...messages.filter(m => m.role !== 'system')];
                  } else {
                    messages = [{ role: 'system', content: thinkingPrompt }, ...messages];
                  }
                }
              }
            }
            
            // Log comprehensive configuration before making the API call
            const preferences = user.modelPreferences as Record<string, Record<string, { thinking?: boolean; temperature?: number }>> | null;
            const hasUserPrefs = effectiveAgentType && selectedModel && preferences?.[effectiveAgentType]?.[selectedModel];
            const configSource = hasUserPrefs 
              ? 'user preferences' 
              : providedTemperature !== undefined 
                ? 'explicit parameter' 
                : 'default';
            
            console.log(`\n📋 [LLM Service] Configuration Summary:`);
            console.log(`   Model: ${selectedModel}`);
            console.log(`   Agent Type: ${effectiveAgentType}`);
            console.log(`   Task Type: ${taskType}`);
            console.log(`   Temperature: ${finalTemperature} (source: ${configSource})`);
            console.log(`   Thinking Mode: ${thinkingMode} (${thinkingMode ? 'enabled' : 'disabled'})`);
            console.log(`   Max Tokens: ${optimalMaxTokens}${max_tokens ? ` (requested: ${max_tokens})` : ' (calculated)'}`);
            console.log(`   System Prompt: ${system_prompt ? 'yes' : 'no'}`);
            console.log(`   Message Count: ${messages.length}`);
            if (hasUserPrefs) {
              const prefs = preferences![effectiveAgentType][selectedModel];
              console.log(`   User Preferences Applied:`, {
                thinking: prefs.thinking,
                temperature: prefs.temperature,
              });
            }
            console.log(`\n`);
            
            const response = await openRouterService.chatCompletion(messages, requestOptions);

            return {
              content: response.content,
              model: response.model,
              usage: response.usage,
            };
          } catch (openRouterApiError) {
            const errorMessage = openRouterApiError instanceof Error ? openRouterApiError.message : String(openRouterApiError);
            console.error('❌ OpenRouter API error:', errorMessage);
            console.error('❌ Full error:', openRouterApiError);
            // Store the error to handle it after the try-catch
            openRouterError = new Error(`OpenRouter API failed: ${errorMessage}`);
            // Don't re-throw here - let it fall through to be handled below
          }
        } else {
          console.log(`ℹ️  [LLM Service] No OpenRouter API key found in user's database record (userId: ${userId})`);
        }
      } catch (error) {
        // Catch config/database errors
        console.error('Error checking OpenRouter config, falling back to default:', error);
        // Fall through to default behavior for config errors
      }
    }

    // If user has OpenRouter configured but it failed, throw clear error
    if (openRouterAttempted && openRouterHadKey && openRouterError) {
      // Re-throw the OpenRouter error with helpful context
      throw new Error(`${openRouterError.message} Please check your API key and model name in settings. Common issues: invalid API key, incorrect model name format (e.g., "x-ai/grok-4.1-fast:free" should be "x-ai/grok-beta"), or model not available.`);
    }

    // If OpenRouter wasn't configured, user must configure it
    throw new Error('No LLM service available. Please configure your OpenRouter API key in settings.');
  }


  /**
   * Get available models (useful for debugging)
   */
  async getAvailableModels(): Promise<string[]> {
    return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
  }

  /**
   * Get service info for debugging
   */
  getServiceInfo() {
    return {
      provider: 'OpenRouter (user-configured API keys only)',
      defaultModel: this.defaultModel,
      environment: process.env.NODE_ENV,
    };
  }
}

// Singleton instance
export const llmService = new LLMService();

