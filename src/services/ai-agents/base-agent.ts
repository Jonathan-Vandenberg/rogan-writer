import { Chapter } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface BaseAgent {
  analyze(chapters: Chapter[], bookId: string, additionalContext?: any): Promise<any[]>;
}

export abstract class AIAgent implements BaseAgent {
  
  constructor() {
    // Don't access llmService in constructor to avoid build-time errors
    // Service info will be logged when first used
  }

  /**
   * Get LLM service lazily to avoid build-time errors
   */
  protected async getLLMService() {
    const { llmService } = await import('../llm.service');
    return llmService;
  }

  abstract analyze(chapters: Chapter[], bookId: string, additionalContext?: any): Promise<any[]>;

  protected async callOpenAI(prompt: string, bookId?: string): Promise<string> {
    try {
      // Get userId from bookId for OpenRouter config
      let userId: string | undefined;
      if (bookId) {
        const book = await prisma.book.findUnique({
          where: { id: bookId },
          select: { userId: true },
        });
        userId = book?.userId;
      }

      const llmService = await this.getLLMService();
      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          system_prompt: 'You are an expert AI assistant specialized in analyzing book content. Always return valid JSON responses.',
          // Don't set temperature - use user's default temperature
          max_tokens: 8000, // Increased from 2000 - analysis can benefit from longer responses (GPT-4 Turbo: 128K context)
          userId, // Pass userId for OpenRouter config and temperature
          taskType: 'default', // Use default temperature for analysis
        }
      );

      return response.content;
    } catch (error) {
      console.error('LLM API error:', error);
      throw new Error('Failed to get AI response');
    }
  }

  protected cleanAndParseJSON(responseContent: string): any[] {
    if (!responseContent) {
      return [];
    }

    try {
      // Clean the response content
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\s*```$/, '');
      }
      
      // More comprehensive JSON cleanup
      jsonContent = jsonContent
        .replace(/,(\s*[}\]])/g, '$1')       // Remove trailing commas before } or ]
        .replace(/[\u0000-\u0019]+/g, '')    // Remove control characters
        .trim();
      
      return JSON.parse(jsonContent);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.error('Failed to parse AI response:', responseContent);
      return [];
    }
  }

  protected combinedChapterContent(chapters: Chapter[]): string {
    return chapters
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(chapter => `Chapter ${chapter.orderIndex + 1}: ${chapter.title}\n\n${chapter.content}`)
      .join('\n\n---\n\n');
  }
}
