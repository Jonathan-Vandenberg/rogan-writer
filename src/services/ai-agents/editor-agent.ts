/**
 * Editor Agent
 * AI-powered book editing agent using Grok 4 Fast
 * Intelligently loads chapters and generates structured edits
 */

import { grokService } from '@/services/grok.service';
import { prisma } from '@/lib/db';
import { Chapter } from '@prisma/client';
import * as Diff from 'diff';
import { PlanningContextService } from '@/services/planning-context.service';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChapterEditRequest {
  chapterId: string;
  originalContent: string;
  editedContent: string;
  reasoning: string;
}

interface NewChapterRequest {
  title: string;
  content: string;
  orderIndex: number;
  reasoning: string;
}

interface EditResponse {
  type: 'edit' | 'create' | 'message';
  message: string;
  edits?: ChapterEditRequest[];
  newChapters?: NewChapterRequest[];
  chaptersLoaded?: Array<{ id: string; title: string }>;
}

export class EditorAgent {
  /**
   * Determine which chapters to load based on user request
   */
  async determineRequiredChapters(
    bookId: string,
    userRequest: string,
    conversationHistory: ConversationMessage[]
  ): Promise<{ chapters: Chapter[]; reasoning: string }> {
    // Fetch all chapters with basic info
    const allChapters = await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        wordCount: true,
      },
    });

    if (allChapters.length === 0) {
      return { chapters: [], reasoning: 'No chapters found in this book.' };
    }

    // Build chapter list summary
    const chapterSummary = allChapters
      .map((ch, idx) => `${idx + 1}. "${ch.title}" (${ch.wordCount} words)`)
      .join('\n');

    // Ask Grok to analyze the request and determine scope
    const analysisPrompt = `You are an intelligent book editor assistant. Analyze the user's editing request and determine which chapters need to be loaded.

AVAILABLE CHAPTERS:
${chapterSummary}

USER REQUEST: "${userRequest}"

CONVERSATION HISTORY:
${conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}

Respond with a JSON object in this exact format:
{
  "scope": "all" | "specific" | "none",
  "chapterIndices": [0, 1, 2],
  "reasoning": "explanation of why these chapters were selected"
}

RULES:
- Use "all" for broad requests like "improve dialogue", "fix pacing", "enhance descriptions"
- Use "specific" for targeted requests mentioning chapter numbers or specific scenes
- Use "none" for general questions or when no editing is needed yet
- chapterIndices should be an array of 0-based indices (0 = first chapter)
- Always provide clear reasoning`;

    try {
      const response = await grokService.chatCompletion([
        { role: 'user', content: analysisPrompt }
      ], {
        temperature: 0.3,
        max_tokens: 500,
      });

      const analysis = this.parseJSON(response.content);
      
      let selectedChapters: Chapter[];
      
      if (analysis.scope === 'all') {
        // Load all chapters with full content
        selectedChapters = await prisma.chapter.findMany({
          where: { bookId },
          orderBy: { orderIndex: 'asc' },
        });
      } else if (analysis.scope === 'specific' && Array.isArray(analysis.chapterIndices)) {
        // Load specific chapters
        const chapterIds = analysis.chapterIndices
          .map((idx: number) => allChapters[idx]?.id)
          .filter(Boolean);
        
        selectedChapters = await prisma.chapter.findMany({
          where: {
            id: { in: chapterIds },
          },
          orderBy: { orderIndex: 'asc' },
        });
      } else {
        selectedChapters = [];
      }

      return {
        chapters: selectedChapters,
        reasoning: analysis.reasoning || 'Chapters selected based on request scope.',
      };
    } catch (error) {
      console.error('Error determining chapters:', error);
      // Fallback: load all chapters if analysis fails
      const allChaptersWithContent = await prisma.chapter.findMany({
        where: { bookId },
        orderBy: { orderIndex: 'asc' },
      });
      
      return {
        chapters: allChaptersWithContent,
        reasoning: 'Analysis failed, loaded all chapters as fallback.',
      };
    }
  }

  /**
   * Process an editing request
   */
  async processEditRequest(
    bookId: string,
    userRequest: string,
    conversationHistory: ConversationMessage[],
    loadedChapters?: Chapter[],
    includePlanningData: boolean = false,
    grokModel: string = 'grok-4-fast-non-reasoning'
  ): Promise<EditResponse> {
    // Get book metadata first
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        title: true,
        description: true,
        genre: true,
        targetWords: true,
      },
    });

    // Fetch planning data if requested (do this BEFORE checking for chapters)
    let planningContext = '';
    if (includePlanningData) {
      try {
        console.log('📚 Fetching planning data for Editor Agent...');
        const fullPlanningContext = await PlanningContextService.buildPlanningContext(bookId);
        planningContext = `

COMPREHENSIVE BOOK PLANNING DATA:
${fullPlanningContext}

---
`;
        console.log(`✅ Planning context loaded (${planningContext.length} chars)`);
      } catch (error) {
        console.error('Error loading planning context:', error);
        planningContext = '\n(Planning data unavailable)\n';
      }
    }

    // Determine which chapters to load if not provided
    let chapters = loadedChapters;
    let loadingReasoning = '';
    
    if (!chapters || chapters.length === 0) {
      const result = await this.determineRequiredChapters(bookId, userRequest, conversationHistory);
      chapters = result.chapters;
      loadingReasoning = result.reasoning;
    }

    // If no chapters are loaded and no planning data, return a conversational response
    if (chapters.length === 0 && !includePlanningData) {
      return {
        type: 'message',
        message: `I understand you want to: "${userRequest}". However, I need to load some chapters first. Could you please specify which chapters you'd like me to edit, or ask me to review the entire book?`,
      };
    }

    // Build context for Grok
    const chaptersSection = chapters.length > 0 ? `
LOADED CHAPTERS (${chapters.length} total):
${chapters.map((ch, idx) => `
Chapter ${idx + 1}: "${ch.title}"
Chapter ID: ${ch.id}
Word Count: ${ch.wordCount}
Content:
${ch.content}
---
`).join('\n')}` : '\n(No chapters loaded yet)\n';

    const bookContext = `BOOK INFORMATION:
Title: ${book?.title || 'Untitled'}
Genre: ${book?.genre || 'Not specified'}
Target Word Count: ${book?.targetWords || 'Not specified'}
Description: ${book?.description || 'No description'}
${planningContext}
${chaptersSection}`;

    // Build the editing prompt - different approach if only planning data is available
    const hasChapters = chapters.length > 0;
    const hasPlanningData = includePlanningData && planningContext.length > 0;
    
    const editingPrompt = hasChapters 
      ? `You are an expert book editor using Grok 4 Fast. You have been given access to chapters from the book and a user's editing request.`
      : `You are an expert book editor using Grok 4 Fast. ${hasPlanningData ? 'You have access to comprehensive planning data for the book.' : ''} The user has asked a question about the book.`;
    
    const instructions = hasChapters ? `
CRITICAL EDITING RULES:
1. ONLY make changes that DIRECTLY address the user's specific request
2. DO NOT make any changes beyond what was explicitly requested
3. PRESERVE the author's original writing style, voice, and word choices
4. DO NOT rewrite sentences unless the user asked to improve writing/style
5. DO NOT change vocabulary or phrasing unless specifically requested
6. If the request is about repetitions, ONLY remove/consolidate repetitions
7. If the request is about dialogue, ONLY edit dialogue
8. If the request is about descriptions, ONLY edit descriptions
9. Be MINIMAL and SURGICAL in your edits - less is more
10. When in doubt, make NO change rather than an unnecessary change

INSTRUCTIONS:
1. Analyze the user's request to understand EXACTLY what they want changed
2. Identify ONLY the specific elements that match their request
3. Make ONLY those specific changes, nothing more
4. Preserve everything else exactly as written` : `
INSTRUCTIONS:
1. Answer the user's question based on the planning data provided
2. Be specific and reference actual data from the planning tables
3. If the user asks about something not in the planning data, let them know
4. Provide helpful, detailed answers that show you understand the book's planning`;

    const fullPrompt = `${editingPrompt}

${bookContext}

USER REQUEST: "${userRequest}"

CONVERSATION HISTORY:
${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n\n')}
${instructions}

Respond with a JSON object in this format:
{
  "type": "edit" | "create" | "message",
  "message": "Brief explanation of ONLY the specific changes you made",
  "edits": [
    {
      "chapterId": "use-the-exact-Chapter-ID-provided-above",
      "originalContent": "original text",
      "editedContent": "edited text",
      "reasoning": "specific reason this addresses the user's request"
    }
  ],
  "newChapters": [
    {
      "title": "Chapter Title",
      "content": "Full chapter content",
      "orderIndex": 5,
      "reasoning": "why this chapter should be added"
    }
  ]
}

IMPORTANT:
- Only include "edits" if you're actually editing existing chapters
- Only include "newChapters" if you're creating new chapters
- For "chapterId", use the EXACT "Chapter ID" value shown above for each chapter
- Keep your "message" concise and focused on what changed
- DO NOT explain why other parts are good - only explain changes made
- Make as FEW changes as possible while addressing the request`;

    try {
      console.log(`🤖 Using Grok model: ${grokModel}`);
      const response = await grokService.chatCompletion([
        { role: 'user', content: fullPrompt }
      ], {
        temperature: 0.5, // Lower temperature for more conservative, focused edits
        max_tokens: 16000, // Increased for large responses
        model: grokModel,
      });

      console.log(`📦 Response size: ${response.content.length} characters`);
      
      const result = this.parseJSON(response.content);
      
      return {
        ...result,
        chaptersLoaded: chapters.map(ch => ({ id: ch.id, title: ch.title })),
      };
    } catch (error) {
      console.error('Error processing edit request:', error);
      throw new Error('Failed to process editing request. Please try again.');
    }
  }

  /**
   * Process an editing request with streaming (for reasoning model)
   */
  async processEditRequestStreaming(
    bookId: string,
    userRequest: string,
    conversationHistory: ConversationMessage[],
    loadedChapters: Chapter[] | undefined,
    includePlanningData: boolean,
    grokModel: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // Build the same context as non-streaming
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        title: true,
        description: true,
        genre: true,
        targetWords: true,
      },
    });

    let planningContext = '';
    if (includePlanningData) {
      try {
        const fullPlanningContext = await PlanningContextService.buildPlanningContext(bookId);
        planningContext = `\n\nCOMPREHENSIVE BOOK PLANNING DATA:\n${fullPlanningContext}\n\n---\n`;
      } catch (error) {
        planningContext = '\n(Planning data unavailable)\n';
      }
    }

    let chapters = loadedChapters;
    if (!chapters || chapters.length === 0) {
      const result = await this.determineRequiredChapters(bookId, userRequest, conversationHistory);
      chapters = result.chapters;
    }

    const chaptersSection = chapters.length > 0 ? `
LOADED CHAPTERS (${chapters.length} total):
${chapters.map((ch, idx) => `
Chapter ${idx + 1}: "${ch.title}"
Chapter ID: ${ch.id}
Word Count: ${ch.wordCount}
Content:
${ch.content}
---
`).join('\n')}` : '\n(No chapters loaded yet)\n';

    const bookContext = `BOOK INFORMATION:
Title: ${book?.title || 'Untitled'}
Genre: ${book?.genre || 'Not specified'}
Target Word Count: ${book?.targetWords || 'Not specified'}
Description: ${book?.description || 'No description'}
${planningContext}
${chaptersSection}`;

    const hasChapters = chapters.length > 0;
    const hasPlanningData = includePlanningData && planningContext.length > 0;
    
    const editingPrompt = hasChapters 
      ? `You are an expert book editor using Grok. You have been given access to chapters from the book and a user's editing request.`
      : `You are an expert book editor using Grok. ${hasPlanningData ? 'You have access to comprehensive planning data for the book.' : ''} The user has asked a question about the book.`;
    
    const instructions = hasChapters ? `
CRITICAL EDITING RULES:
1. Show your reasoning process first
2. Then provide structured edits in JSON format
3. ONLY make changes that address the user's request
4. PRESERVE the author's style and voice

After explaining your reasoning, respond with a JSON object in this format:
{
  "type": "edit" | "create" | "message",
  "message": "Brief explanation of changes",
  "edits": [
    {
      "chapterId": "use-the-exact-Chapter-ID-provided-above",
      "originalContent": "original text",
      "editedContent": "edited text",
      "reasoning": "why this change"
    }
  ]
}` : `
Please analyze the planning data and provide a helpful response. If you have suggestions, format them clearly.`;

    const fullPrompt = `${editingPrompt}\n\n${bookContext}\n\nUSER REQUEST: "${userRequest}"\n\nCONVERSATION HISTORY:\n${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n\n')}\n${instructions}`;

    console.log(`🤖 Streaming with Grok model: ${grokModel}`);
    
    await grokService.streamChatCompletion(
      [{ role: 'user', content: fullPrompt }],
      onChunk,
      {
        temperature: 0.5,
        max_tokens: 16000,
        model: grokModel,
      }
    );
  }

  /**
   * Generate a unified diff between original and edited content
   */
  generateDiff(original: string, edited: string): string {
    const diff = Diff.createPatch(
      'chapter',
      original,
      edited,
      'Original',
      'Edited'
    );
    return diff;
  }

  /**
   * Parse JSON from Grok response, handling markdown code blocks and malformed JSON
   */
  private parseJSON(content: string): any {
    try {
      // Remove markdown code blocks if present
      let cleaned = content.trim();
      
      // Handle markdown code blocks
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      // Try to extract JSON if there's text before/after it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleaned);
      console.log('✅ Successfully parsed JSON response:', parsed.type);
      return parsed;
    } catch (error: any) {
      console.error('❌ Failed to parse JSON:', error.message);
      console.error('Content length:', content.length);
      console.error('First 500 chars:', content.substring(0, 500));
      
      // Try to repair the JSON by finding the last valid closing brace
      try {
        console.log('🔧 Attempting JSON repair...');
        let cleaned = content.trim();
        
        // Remove markdown
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        
        // Extract main JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
        
        // Try to find and fix common JSON errors
        // Remove trailing commas before closing brackets/braces
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing again
        const repaired = JSON.parse(cleaned);
        console.log('✅ Successfully repaired and parsed JSON');
        return repaired;
      } catch (repairError) {
        console.error('❌ JSON repair failed');
        
        // Last resort: try to extract at least the message and type
        try {
          const typeMatch = content.match(/"type"\s*:\s*"([^"]+)"/);
          const messageMatch = content.match(/"message"\s*:\s*"([^"]+)"/);
          
          if (typeMatch || messageMatch) {
            console.log('📝 Extracted partial response');
            return {
              type: typeMatch ? typeMatch[1] : 'message',
              message: messageMatch ? messageMatch[1] : 'Processing your request...',
            };
          }
        } catch (extractError) {
          console.error('❌ Could not extract any data');
        }
        
        // Return a fallback message response
        return {
          type: 'message',
          message: 'The response was too large and could not be fully processed. Please try editing fewer chapters at once, or make a more specific request (e.g., "edit chapter 3" instead of "edit all chapters").',
        };
      }
    }
  }
}

export const editorAgent = new EditorAgent();

