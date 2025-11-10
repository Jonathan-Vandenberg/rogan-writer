import { Chapter } from '@prisma/client';
import { llmService } from '../llm.service';

export interface BaseAgent {
  analyze(chapters: Chapter[], bookId: string, additionalContext?: any): Promise<any[]>;
}

export abstract class AIAgent implements BaseAgent {
  
  constructor() {
    // Log which LLM service we're using
    const serviceInfo = llmService.getServiceInfo();
    console.log(`🤖 ${this.constructor.name}: Using ${serviceInfo.isLocal ? 'Ollama' : 'OpenAI'} (${serviceInfo.defaultModel})`);
  }

  abstract analyze(chapters: Chapter[], bookId: string, additionalContext?: any): Promise<any[]>;

  protected async callOpenAI(prompt: string): Promise<string> {
    try {
      const response = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          system_prompt: 'You are an expert AI assistant specialized in analyzing book content. Always return valid JSON responses.',
          temperature: 0.7,
          max_tokens: 2000,
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
