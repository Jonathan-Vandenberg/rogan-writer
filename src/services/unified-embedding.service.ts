/**
 * Unified Embedding Service
 * 
 * Manages a single vector store for ALL book content (chapters, characters, 
 * locations, plot, timeline, brainstorming, scenes, research) with chunking
 * for efficient semantic search.
 * 
 * Architecture:
 * - Embeddings: Uses OpenAI ada-002 by default, or OpenRouter if user-configured
 * - LLM: Can use either OpenAI or Ollama (configured separately in llm.service.ts)
 * 
 * This allows you to use a free local LLM (Ollama) while still getting high-quality
 * embeddings from OpenAI for semantic search, or use OpenRouter for custom models.
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { decrypt, maskApiKey } from './encryption.service';
import { OpenRouterService } from './openrouter.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface UpdateSourceParams {
  bookId: string;
  sourceType: 'chapter' | 'brainstorming' | 'character' | 'location' | 'plotPoint' | 'timeline' | 'sceneCard' | 'research';
  sourceId: string;
  content: string;
  metadata: Record<string, any>;
}

interface SearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export class UnifiedEmbeddingService {
  private readonly CHUNK_SIZE = 800; // characters per chunk
  private readonly OVERLAP = 100; // overlap between chunks for context

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  No OPENAI_API_KEY found. Embeddings will fail. Set OPENAI_API_KEY in .env');
    } else {
      console.log('🌐 Unified Embeddings: Using OpenAI');
    }
  }

  /**
   * Chunk text into smaller pieces with overlap
   */
  private chunkText(text: string): string[] {
    if (!text || text.length === 0) return [];
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      const chunk = text.slice(start, end).trim();
      
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      
      // Move to next chunk with overlap
      start = end - this.OVERLAP;
      
      // Prevent infinite loop
      if (start >= text.length || end === text.length) break;
    }
    
    return chunks.length > 0 ? chunks : [text.slice(0, this.CHUNK_SIZE)];
  }

  /**
   * Generate embedding for text
   * Uses OpenRouter if user has configured it, otherwise falls back to OpenAI
   */
  private async generateEmbedding(text: string, userId?: string): Promise<number[]> {
    try {
      const cleanText = text.slice(0, 8000).trim();
      
      if (!cleanText) {
        throw new Error('Text is empty');
      }

      // Check for OpenRouter configuration if user ID is provided
      if (userId) {
        try {
          console.log(`🔍 [Unified Embedding Service] Checking for user's OpenRouter API key in database (userId: ${userId})`);
          console.log(`🔍 [Unified Embedding Service] NOT checking environment variables - using user's database-stored key only`);
          
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              openRouterApiKey: true,
              openRouterEmbeddingModel: true,
            },
          });

          if (user?.openRouterApiKey && user.openRouterEmbeddingModel) {
            const apiKey = decrypt(user.openRouterApiKey);
            const maskedKey = maskApiKey(apiKey);
            
            console.log(`✅ [Unified Embedding Service] Found user's OpenRouter API key in database: ${maskedKey}`);
            console.log(`✅ [Unified Embedding Service] Using USER'S API KEY from database (NOT env variables)`);
            console.log(`🔒 [Unified Embedding Service] Environment OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'EXISTS but NOT USED' : 'NOT SET (as expected)'}`);
            console.log(`📝 [Unified Embedding Service] Using embedding model: ${user.openRouterEmbeddingModel}`);
            
            const openRouterService = new OpenRouterService(apiKey);
            
            const response = await openRouterService.generateEmbedding(
              cleanText,
              user.openRouterEmbeddingModel
            );

            return response.embedding;
          } else {
            console.log(`ℹ️  [Unified Embedding Service] No OpenRouter API key or embedding model found in user's database record (userId: ${userId})`);
            console.log(`ℹ️  [Unified Embedding Service] Falling back to OpenAI from env`);
          }
        } catch (error) {
          console.error('Error using OpenRouter for embeddings, falling back to OpenAI:', error);
          // Fall through to OpenAI
        }
      }

      // Default: Use OpenAI
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured and no OpenRouter configuration found');
      }

      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: cleanText,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update embeddings for a specific source (chapter, character, etc.)
   */
  async updateSourceEmbeddings(params: UpdateSourceParams): Promise<void> {
    const { bookId, sourceType, sourceId, content, metadata } = params;

    console.log(`🔄 Updating embeddings for ${sourceType}:${sourceId}`);

    try {
      // Get userId from book for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;

      // Delete old chunks for this source
      await prisma.bookEmbeddingChunk.deleteMany({
        where: { bookId, sourceType, sourceId }
      });

      // Chunk the content
      const chunks = this.chunkText(content);
      
      if (chunks.length === 0) {
        console.log(`⚠️  No content to embed for ${sourceType}:${sourceId}`);
        return;
      }

      console.log(`📝 Creating ${chunks.length} chunks for ${sourceType}:${sourceId}`);

      // Create embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.generateEmbedding(chunks[i], userId);
        
        await prisma.$executeRaw`
          INSERT INTO book_embedding_chunks 
          ("id", "bookId", "sourceType", "sourceId", "chunkIndex", "content", "metadata", "embedding", "createdAt", "updatedAt")
          VALUES (
            ${`${sourceId}_chunk_${i}`},
            ${bookId},
            ${sourceType},
            ${sourceId},
            ${i},
            ${chunks[i]},
            ${JSON.stringify(metadata)}::jsonb,
            ${JSON.stringify(embedding)}::vector,
            NOW(),
            NOW()
          )
          ON CONFLICT ("id") DO UPDATE SET
            "content" = EXCLUDED."content",
            "metadata" = EXCLUDED."metadata",
            "embedding" = EXCLUDED."embedding",
            "updatedAt" = NOW()
        `;
      }

      console.log(`✅ Updated ${chunks.length} chunks for ${sourceType}:${sourceId}`);
    } catch (error) {
      console.error(`❌ Error updating embeddings for ${sourceType}:${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all embeddings for a specific source
   */
  async deleteSourceEmbeddings(bookId: string, sourceType: string, sourceId: string): Promise<void> {
    console.log(`🗑️  Deleting embeddings for ${sourceType}:${sourceId}`);

    try {
      await prisma.bookEmbeddingChunk.deleteMany({
        where: { bookId, sourceType, sourceId }
      });

      console.log(`✅ Deleted embeddings for ${sourceType}:${sourceId}`);
    } catch (error) {
      console.error(`❌ Error deleting embeddings for ${sourceType}:${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Search across ALL book content using semantic similarity
   */
  async searchBookContent(bookId: string, query: string, limit: number = 20): Promise<SearchResult[]> {
    try {
      console.log(`🔍 Searching book ${bookId} for: "${query}"`);
      
      // Get userId from book for OpenRouter config
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { userId: true },
      });
      const userId = book?.userId;
      
      const queryEmbedding = await this.generateEmbedding(query, userId);
      
      const results = await prisma.$queryRaw<SearchResult[]>`
        SELECT 
          id, 
          "sourceType", 
          "sourceId", 
          content, 
          metadata,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM book_embedding_chunks
        WHERE "bookId" = ${bookId} 
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;
      
      console.log(`📚 Found ${results.length} relevant chunks`);
      
      return results;
    } catch (error) {
      console.error('Error searching book content:', error);
      return [];
    }
  }

  /**
   * Regenerate ALL embeddings for a book
   */
  async regenerateBookEmbeddings(bookId: string): Promise<void> {
    console.log(`🔄 Regenerating all embeddings for book ${bookId}`);

    try {
      // Delete all existing chunks for this book
      await prisma.bookEmbeddingChunk.deleteMany({ where: { bookId } });

      let totalChunks = 0;

      // Process chapters
      const chapters = await prisma.chapter.findMany({
        where: { bookId },
        select: { id: true, title: true, content: true, orderIndex: true }
      });

      for (const chapter of chapters) {
        if (chapter.content) {
          await this.updateSourceEmbeddings({
            bookId,
            sourceType: 'chapter',
            sourceId: chapter.id,
            content: `Chapter ${chapter.orderIndex + 1}: ${chapter.title}\n\n${chapter.content}`,
            metadata: { title: chapter.title, orderIndex: chapter.orderIndex, chapterNumber: chapter.orderIndex + 1 }
          });
          totalChunks++;
        }
      }

      // Process brainstorming notes
      const brainstorms = await prisma.brainstormingNote.findMany({
        where: { bookId },
        select: { id: true, title: true, content: true, tags: true }
      });

      for (const note of brainstorms) {
        await this.updateSourceEmbeddings({
          bookId,
          sourceType: 'brainstorming',
          sourceId: note.id,
          content: `Brainstorm: ${note.title}\n\n${note.content}`,
          metadata: { title: note.title, tags: note.tags }
        });
        totalChunks++;
      }

      // Process characters
      const characters = await prisma.character.findMany({
        where: { bookId },
        select: { id: true, name: true, description: true, role: true, appearance: true, personality: true, backstory: true }
      });

      for (const char of characters) {
        const content = [
          `Character: ${char.name}`,
          char.role ? `Role: ${char.role}` : '',
          char.description ? `Description: ${char.description}` : '',
          char.appearance ? `Appearance: ${char.appearance}` : '',
          char.personality ? `Personality: ${char.personality}` : '',
          char.backstory ? `Backstory: ${char.backstory}` : ''
        ].filter(Boolean).join('\n\n');

        if (content.length > 0) {
          await this.updateSourceEmbeddings({
            bookId,
            sourceType: 'character',
            sourceId: char.id,
            content,
            metadata: { name: char.name, role: char.role }
          });
          totalChunks++;
        }
      }

      // Process locations
      const locations = await prisma.location.findMany({
        where: { bookId },
        select: { id: true, name: true, description: true, geography: true, culture: true }
      });

      for (const loc of locations) {
        const content = [
          `Location: ${loc.name}`,
          loc.description ? `Description: ${loc.description}` : '',
          loc.geography ? `Geography: ${loc.geography}` : '',
          loc.culture ? `Culture: ${loc.culture}` : ''
        ].filter(Boolean).join('\n\n');

        if (content.length > 0) {
          await this.updateSourceEmbeddings({
            bookId,
            sourceType: 'location',
            sourceId: loc.id,
            content,
            metadata: { name: loc.name }
          });
          totalChunks++;
        }
      }

      // Process plot points
      const plotPoints = await prisma.plotPoint.findMany({
        where: { bookId },
        select: { id: true, type: true, title: true, description: true, orderIndex: true }
      });

      for (const plot of plotPoints) {
        const content = `Plot Point: ${plot.title}\nType: ${plot.type}\n\n${plot.description || ''}`;
        await this.updateSourceEmbeddings({
          bookId,
          sourceType: 'plotPoint',
          sourceId: plot.id,
          content,
          metadata: { title: plot.title, type: plot.type, orderIndex: plot.orderIndex }
        });
        totalChunks++;
      }

      // Process timeline events
      const timeline = await prisma.timelineEvent.findMany({
        where: { bookId },
        select: { id: true, title: true, description: true, eventDate: true, startTime: true, endTime: true }
      });

      for (const event of timeline) {
        const content = [
          `Timeline Event: ${event.title}`,
          event.eventDate ? `Date: ${event.eventDate}` : '',
          `Time: ${event.startTime} - ${event.endTime}`,
          event.description || ''
        ].filter(Boolean).join('\n\n');

        if (content.length > 0) {
          await this.updateSourceEmbeddings({
            bookId,
            sourceType: 'timeline',
            sourceId: event.id,
            content,
            metadata: { title: event.title, eventDate: event.eventDate, startTime: event.startTime, endTime: event.endTime }
          });
          totalChunks++;
        }
      }

      // Process scene cards
      const scenes = await prisma.sceneCard.findMany({
        where: { bookId },
        select: { id: true, title: true, description: true, purpose: true, conflict: true, outcome: true }
      });

      for (const scene of scenes) {
        const content = [
          `Scene: ${scene.title}`,
          scene.description ? `Description: ${scene.description}` : '',
          scene.purpose ? `Purpose: ${scene.purpose}` : '',
          scene.conflict ? `Conflict: ${scene.conflict}` : '',
          scene.outcome ? `Outcome: ${scene.outcome}` : ''
        ].filter(Boolean).join('\n\n');

        if (content.length > 0) {
          await this.updateSourceEmbeddings({
            bookId,
            sourceType: 'sceneCard',
            sourceId: scene.id,
            content,
            metadata: { title: scene.title }
          });
          totalChunks++;
        }
      }

      // Process research results
      const research = await prisma.researchResult.findMany({
        where: { bookId },
        select: { id: true, title: true, summary: true, content: true }
      });

      for (const item of research) {
        const content = [
          `Research: ${item.title}`,
          item.summary,
          item.content || ''
        ].filter(Boolean).join('\n\n');

        if (content.length > 0) {
          await this.updateSourceEmbeddings({
            bookId,
            sourceType: 'research',
            sourceId: item.id,
            content,
            metadata: { title: item.title }
          });
          totalChunks++;
        }
      }

      console.log(`✅ Regenerated embeddings for book ${bookId}: ${totalChunks} sources processed`);
    } catch (error) {
      console.error(`❌ Error regenerating embeddings for book ${bookId}:`, error);
      throw error;
    }
  }
}

export const unifiedEmbeddingService = new UnifiedEmbeddingService();

