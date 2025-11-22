/**
 * Image Generation Service
 * Handles generating cover art images for books using AI models
 */

import { prisma } from '@/lib/db';
import { decrypt } from './encryption.service';
import { llmService } from './llm.service';

interface GenerateCoverArtParams {
  bookId: string;
  userId: string;
  title: string;
  description?: string | null;
  genre?: string | null;
  authorName?: string | null; // Author's name for cover art generation
  customPrompt?: string | null; // Optional custom prompt from user
}

interface ImageGenerationResult {
  imageUrl: string;
  s3Key: string;
  prompt: string;
  model: string;
}

export class ImageGenerationService {
  /**
   * Generate a cover art prompt using LLM
   */
  private async generateCoverPrompt(
    title: string,
    description: string | null | undefined,
    genre: string | null | undefined,
    authorName: string | null | undefined,
    userId: string
  ): Promise<string> {
    const promptContext = `
You are a professional book cover designer. Generate a detailed, vivid prompt for an AI image generation model to create a book cover.

Book Details:
- Title: ${title}
${authorName ? `- Author: ${authorName}` : ''}
${description ? `- Description: ${description}` : ''}
${genre ? `- Genre: ${genre}` : ''}

Requirements:
1. Create a compelling, professional book cover design prompt
2. The prompt should be detailed and descriptive (100-200 words)
3. Include visual elements that represent the book's theme and genre
4. Specify the mood, color palette, and style
5. Make it suitable for a book cover (portrait orientation, professional quality)
6. Focus on key visual elements that would attract readers
${authorName ? `7. Consider the author's style and reputation when designing the cover aesthetic` : ''}

Generate ONLY the image generation prompt, nothing else.
`.trim();

    try {
      const response = await llmService.chatCompletion(
        [
          {
            role: 'system',
            content: 'You are a professional book cover designer. Generate detailed, vivid prompts for AI image generation models.',
          },
          {
            role: 'user',
            content: promptContext,
          },
        ],
        {
          userId,
          agentType: 'suggestions', // Use suggestions agent for creative tasks
          temperature: 0.8, // Higher temperature for more creative prompts
          max_tokens: 500,
        }
      );

      return response.content.trim();
    } catch (error) {
      console.error('Error generating cover prompt:', error);
      // Fallback to a simple prompt
      return `Professional book cover design for "${title}"${authorName ? ` by ${authorName}` : ''}${genre ? `, ${genre} genre` : ''}${description ? `. ${description}` : ''}. High quality, detailed, book cover art, professional illustration, vibrant colors, compelling composition.`;
    }
  }

  /**
   * Generate image using OpenAI API directly (for DALL-E) or OpenRouter (for other models)
   */
  private async generateImage(
    prompt: string,
    userId: string,
    model?: string
  ): Promise<Buffer> {
    // Get user's API key and model preference
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        openRouterApiKey: true,
        openRouterImageModel: true,
      },
    });

    if (!user?.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured. Please configure it in settings.');
    }

    const apiKey = decrypt(user.openRouterApiKey);
    const selectedModel = model || user.openRouterImageModel;

    // Check if this is a DALL-E model
    const isDALLE = selectedModel && (selectedModel.includes('dall-e') || selectedModel.includes('openai/dall-e'));
    
    // DALL-E models are NOT supported by OpenRouter - they require OpenAI API directly
    if (isDALLE) {
      // Check if the API key is an OpenAI key (starts with sk- but not sk-or-)
      if (apiKey.startsWith('sk-or-')) {
        throw new Error(
          `DALL-E models (${selectedModel}) are not supported through OpenRouter. ` +
          `OpenRouter does not support DALL-E image generation. ` +
          `Please either:\n` +
          `1. Select a different image generation model that OpenRouter supports (like Gemini Flash Image, Flux, etc.), or\n` +
          `2. Configure a separate OpenAI API key for DALL-E image generation.\n\n` +
          `To get an OpenAI API key, visit: https://platform.openai.com/api-keys`
        );
      }
      
      // User has an OpenAI key, use OpenAI API directly for DALL-E
      console.log('Using OpenAI API directly for DALL-E');
      return await this.generateWithOpenAI(apiKey, prompt, selectedModel);
    }
    
    // Use OpenRouter for image generation models that support it
    // OpenRouter supports image generation through chat/completions with modalities parameter
    if (!selectedModel) {
      throw new Error(
        'No image generation model selected. Please select an image generation model in your settings.'
      );
    }
    
    return await this.generateWithOpenRouter(apiKey, prompt, selectedModel);
  }

  /**
   * Generate image using OpenAI DALL-E API directly
   */
  private async generateWithOpenAI(
    apiKey: string,
    prompt: string,
    model: string
  ): Promise<Buffer> {
    // Extract model name (e.g., "openai/dall-e-3" -> "dall-e-3")
    const modelName = model.includes('dall-e-3') ? 'dall-e-3' : 'dall-e-2';
    
    console.log(`🎨 Generating image with OpenAI DALL-E: ${modelName}`);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        n: 1,
        size: '1024x1024', // Square for book covers (can be cropped)
        quality: modelName === 'dall-e-3' ? 'standard' : undefined,
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.data || !data.data[0] || !data.data[0].url) {
      throw new Error('No image URL returned from OpenAI');
    }

    // Download the image
    const imageResponse = await fetch(data.data[0].url);
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image');
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate image using OpenRouter API
   * OpenRouter supports image generation through chat/completions endpoint with modalities: ['image', 'text']
   */
  private async generateWithOpenRouter(
    apiKey: string,
    prompt: string,
    model: string
  ): Promise<Buffer> {
    console.log(`🎨 Generating image with OpenRouter model: ${model}`);
    
    // OpenRouter supports image generation through chat/completions with modalities parameter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://roganwriter.com',
        'X-Title': 'Rogan Writer',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image', 'text'], // Enable image generation
      }),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        // If JSON parsing fails, use empty object
      }
      
      const errorMessage = errorData.error?.message || errorData.message || errorData.error || 'Unknown error';
      const status = response.status;
      
      console.error('OpenRouter image generation error:', {
        status,
        statusText: response.statusText,
        errorData,
        model,
      });
      
      // Check if error indicates model doesn't support image generation
      const errorLower = errorMessage.toLowerCase();
      if (
        errorLower.includes('modality') ||
        errorLower.includes('image generation') ||
        errorLower.includes('does not support') ||
        errorLower.includes('unsupported') ||
        status === 400
      ) {
        throw new Error(
          `The model "${model}" does not support image generation. ` +
          `Error: ${errorMessage}. ` +
          `Please select a model that supports image generation (like Flux, Stable Diffusion, Gemini Flash Image, or DALL-E). ` +
          `You can find image generation models in your settings.`
        );
      }
      
      throw new Error(
        `OpenRouter image generation error (${status} ${response.statusText}): ${errorMessage}. ` +
        `Please check that the model supports image generation and your API key is valid.`
      );
    }

    const data = await response.json();
    
    // Log full response for debugging (truncated for large responses)
    console.log(`📦 Full response structure for ${model}:`, JSON.stringify(data, null, 2).substring(0, 2000));
    
    // Handle OpenRouter response format for image generation
    // Images can be returned in various formats depending on the model
    let imageUrl: string | undefined;
    let base64Image: string | undefined;
    
    if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
      const choice = data.choices[0];
      const message = choice.message;
      
      // Check for images in message.images array (standard OpenRouter format)
      if (message.images && Array.isArray(message.images) && message.images.length > 0) {
        const image = message.images[0];
        
        if (typeof image === 'string') {
          // Base64 image data (data:image/png;base64,...)
          if (image.startsWith('data:image')) {
            base64Image = image.split(',')[1]; // Extract base64 part
          } else if (image.startsWith('http')) {
            // URL string
            imageUrl = image;
          }
        } else if (image && typeof image === 'object') {
          // Handle nested image_url structure (Gemini Flash Image format)
          // Structure: { type: "image_url", image_url: { url: "data:image/..." } }
          if (image.image_url && image.image_url.url) {
            const url = image.image_url.url;
            if (url.startsWith('data:image')) {
              base64Image = url.split(',')[1]; // Extract base64 part
            } else if (url.startsWith('http')) {
              imageUrl = url;
            }
          }
          // Handle direct properties (other formats)
          else if (image.url) {
            const url = image.url;
            if (url.startsWith('data:image')) {
              base64Image = url.split(',')[1]; // Extract base64 part
            } else if (url.startsWith('http')) {
              imageUrl = url;
            }
          } else if (image.b64_json) {
            base64Image = image.b64_json;
          } else if (image.data) {
            base64Image = image.data;
          }
        }
      }
      
      // Check for Gemini-style parts format (message.parts with inline_data)
      if (!imageUrl && !base64Image && message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          // Check for inline_data (Gemini format)
          if (part.inline_data && part.inline_data.data) {
            base64Image = part.inline_data.data;
            break;
          }
          // Check for image URL in parts
          if (part.url && typeof part.url === 'string' && part.url.startsWith('http')) {
            imageUrl = part.url;
            break;
          }
        }
      }
      
      // Check for images in message.content (could be base64 or URL)
      if (!imageUrl && !base64Image && message.content) {
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        
        // Try to find URL
        const urlMatch = content.match(/https?:\/\/[^\s\)"']+\.(jpg|jpeg|png|gif|webp)/i);
        if (urlMatch) {
          imageUrl = urlMatch[0];
        } else {
          // Try to find base64 data URL
          const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
          if (base64Match) {
            base64Image = base64Match[1];
          } else {
            // Try to find raw base64 (without data URL prefix) - might be in JSON
            // Look for long base64 strings (at least 100 chars)
            const rawBase64Match = content.match(/([A-Za-z0-9+/]{100,}={0,2})/);
            if (rawBase64Match && rawBase64Match[1].length > 500) {
              // This might be base64 image data, try to decode it
              try {
                Buffer.from(rawBase64Match[1], 'base64');
                base64Image = rawBase64Match[1];
              } catch (e) {
                // Not valid base64, continue
              }
            }
          }
        }
      }
      
      // Check if content is an array (some models return structured content)
      if (!imageUrl && !base64Image && Array.isArray(message.content)) {
        for (const contentItem of message.content) {
          if (typeof contentItem === 'object' && contentItem.type === 'image_url' && contentItem.image_url) {
            if (contentItem.image_url.url) {
              if (contentItem.image_url.url.startsWith('data:image')) {
                base64Image = contentItem.image_url.url.split(',')[1];
              } else if (contentItem.image_url.url.startsWith('http')) {
                imageUrl = contentItem.image_url.url;
              }
              break;
            }
          } else if (typeof contentItem === 'object' && contentItem.inline_data) {
            base64Image = contentItem.inline_data.data;
            break;
          }
        }
      }
    }
    
    // Log what we found
    if (imageUrl) {
      console.log(`✅ Found image URL: ${imageUrl.substring(0, 100)}...`);
    } else if (base64Image) {
      console.log(`✅ Found base64 image data (${base64Image.length} chars)`);
    } else {
      console.warn(`⚠️ No image found in response structure`);
    }
    
    // Handle base64 image
    if (base64Image) {
      try {
        return Buffer.from(base64Image, 'base64');
      } catch (e) {
        throw new Error('Failed to decode base64 image data');
      }
    }
    
    // Handle URL image
    if (imageUrl) {
      // Validate URL before fetching
      try {
        const url = new URL(imageUrl);
        // Only allow HTTP/HTTPS URLs
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error(`Invalid image URL protocol: ${url.protocol}. Only HTTP and HTTPS are supported.`);
        }
        
        // Check if URL looks like an image URL
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const hasImageExtension = imageExtensions.some(ext => 
          url.pathname.toLowerCase().endsWith(ext)
        );
        
        // Warn if URL doesn't look like an image, but still try to fetch
        if (!hasImageExtension) {
          console.warn(`⚠️ Image URL doesn't have a standard image extension: ${imageUrl}`);
        }
        
        const imageResponse = await fetch(imageUrl, {
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });
        
        if (!imageResponse.ok) {
          throw new Error(
            `Failed to download generated image: ${imageResponse.status} ${imageResponse.statusText}. ` +
            `The model may not support image generation or returned an invalid image URL.`
          );
        }
        
        // Verify content type is an image
        const contentType = imageResponse.headers.get('content-type');
        if (contentType && !contentType.startsWith('image/')) {
          throw new Error(
            `Invalid content type: ${contentType}. Expected an image. ` +
            `The model "${model}" may not support image generation. ` +
            `Please select a model that supports image generation (like Flux, Stable Diffusion, or Gemini Flash Image).`
          );
        }
        
        const arrayBuffer = await imageResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error: any) {
        // Handle network errors (like ENOTFOUND)
        if (error.code === 'ENOTFOUND' || error.name === 'TypeError' && error.message.includes('fetch failed')) {
          throw new Error(
            `Failed to fetch image from URL: ${imageUrl}. ` +
            `This usually means the model "${model}" does not support image generation. ` +
            `The model returned a URL that cannot be accessed or is invalid. ` +
            `Please select a model that supports image generation (like Flux, Stable Diffusion, Gemini Flash Image, or DALL-E).`
          );
        }
        // Re-throw other errors
        throw error;
      }
    }
    
    // No image found - log full response for debugging
    console.error(`❌ No image found in response from model "${model}"`);
    console.error('Full response structure:', JSON.stringify(data, null, 2).substring(0, 3000));
    
    // Check if we got a text response that might contain image info
    if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
      const message = data.choices[0].message;
      const hasTextContent = message.content && typeof message.content === 'string' && message.content.trim();
      
      if (hasTextContent) {
        // Log the text content to help debug
        console.error('Text content received:', message.content.substring(0, 500));
        
        // Some models might return text describing the image or containing metadata
        // Check if the text mentions an image or contains image-related info
        const textLower = message.content.toLowerCase();
        if (textLower.includes('image') || textLower.includes('generated') || textLower.includes('created')) {
          // Might be a description, but we still need the actual image
          throw new Error(
            `The model "${model}" returned text content but no image data. ` +
            `Response: ${message.content.substring(0, 200)}... ` +
            `This might indicate the model needs a different request format or the response structure is different. ` +
            `Please check the server logs for the full response structure.`
          );
        }
      }
    }
    
    // No image found
    throw new Error(
      `No image found in response from model "${model}". ` +
      `The response structure may be different than expected. ` +
      `Please check the server logs for the full response structure to help debug this issue. ` +
      `The model may require a different request format or the image might be in an unexpected location in the response.`
    );
  }

  /**
   * Generate cover art for a book
   */
  async generateCoverArt(params: GenerateCoverArtParams): Promise<ImageGenerationResult> {
    const { bookId, userId, title, description, genre, authorName, customPrompt } = params;

    console.log(`🎨 Generating cover art for book: ${title}${authorName ? ` by ${authorName}` : ''}`);

    // Step 1: Use custom prompt if provided, otherwise generate one using LLM
    let prompt: string;
    if (customPrompt && customPrompt.trim()) {
      // Use user's custom prompt, but enhance it slightly for better results
      prompt = customPrompt.trim();
      // Add some context to make it more suitable for book covers
      if (!prompt.toLowerCase().includes('book cover') && !prompt.toLowerCase().includes('cover art')) {
        prompt = `Professional book cover design: ${prompt}. High quality, detailed, book cover art, professional illustration.`;
      }
      // Add author context if available
      if (authorName && !prompt.toLowerCase().includes(authorName.toLowerCase())) {
        prompt = `${prompt} Book by ${authorName}.`;
      }
      console.log(`📝 Using custom prompt: ${prompt.substring(0, 100)}...`);
    } else {
      // Generate a detailed prompt using LLM from title and description
      prompt = await this.generateCoverPrompt(title, description, genre, authorName, userId);
      console.log(`📝 Generated prompt: ${prompt.substring(0, 100)}...`);
    }

    // Step 2: Generate the image
    const imageBuffer = await this.generateImage(prompt, userId);

    // Step 3: Upload to S3
    const { s3Service } = await import('./s3.service');
    const fileName = `cover_${bookId}_${Date.now()}.png`;
    const s3Result = await s3Service.uploadCoverImage({
      imageBuffer,
      bookId,
      fileName,
      contentType: 'image/png',
    });

    // Get the selected model
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openRouterImageModel: true },
    });
    const model = user?.openRouterImageModel || 'unknown';

    console.log(`✅ Cover art generated and uploaded: ${s3Result.url}`);

    return {
      imageUrl: s3Result.url,
      s3Key: s3Result.s3Key,
      prompt,
      model,
    };
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();

