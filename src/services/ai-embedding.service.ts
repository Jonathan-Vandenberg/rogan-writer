/**
 * AI Embedding Service
 * 
 * Handles OpenAI embeddings generation and vector similarity search
 * for the AI Planning Assistant functionality.
 * Supports OpenRouter for user-configured embedding models.
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { decrypt, maskApiKey } from './encryption.service';
import { OpenRouterService } from './openrouter.service';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIEmbeddingService {
  /**
   * Generate embedding vector for given text
   * Uses OpenRouter if user has configured it, otherwise falls back to OpenAI
   */
  async generateEmbedding(text: string, userId?: string): Promise<number[]> {
    try {
      // Limit text length to avoid token limits (8000 chars ≈ 2000 tokens)
      const cleanText = text.slice(0, 8000).trim();
      
      if (!cleanText) {
        throw new Error('Text is empty or too short for embedding generation');
      }

      // Check for OpenRouter configuration if user ID is provided
      if (userId) {
        try {
          console.log(`🔍 [Embedding Service] Checking for user's OpenRouter API key in database (userId: ${userId})`);
          console.log(`🔍 [Embedding Service] NOT checking environment variables - using user's database-stored key only`);
          
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
            
            console.log(`✅ [Embedding Service] Found user's OpenRouter API key in database: ${maskedKey}`);
            console.log(`✅ [Embedding Service] Using USER'S API KEY from database (NOT env variables)`);
            console.log(`🔒 [Embedding Service] Environment OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'EXISTS but NOT USED' : 'NOT SET (as expected)'}`);
            console.log(`📝 [Embedding Service] Using embedding model: ${user.openRouterEmbeddingModel}`);
            
            const openRouterService = new OpenRouterService(apiKey);
            
            const response = await openRouterService.generateEmbedding(
              cleanText,
              user.openRouterEmbeddingModel
            );

            return response.embedding;
          } else {
            console.log(`ℹ️  [Embedding Service] No OpenRouter API key or embedding model found in user's database record (userId: ${userId})`);
            console.log(`ℹ️  [Embedding Service] Falling back to OpenAI from env`);
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
   * Update brainstorming note embedding (fetches content internally)
   */
  async updateBrainstormingEmbeddingById(brainstormingId: string): Promise<void> {
    try {
      const note = await prisma.brainstormingNote.findUnique({
        where: { id: brainstormingId },
        select: { title: true, content: true }
      });

      if (!note) return;

      // Combine title and content for embedding
      const combinedText = `${note.title}\n${note.content}`;
      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE brainstorming_notes 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${brainstormingId}
      `;
    } catch (error) {
      console.error(`Error updating brainstorming embedding for ${brainstormingId}:`, error);
    }
  }


  /**
   * Update character embedding (fetches content internally)
   */
  async updateCharacterEmbedding(characterId: string): Promise<void> {
    try {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: { name: true, description: true, personality: true, backstory: true, appearance: true }
      });

      if (!character) return;

      // Combine all character fields for embedding
      const combinedText = [
        character.name,
        character.description,
        character.personality, 
        character.backstory,
        character.appearance
      ].filter(Boolean).join('\n');

      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE characters 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${characterId}
      `;
    } catch (error) {
      console.error(`Error updating character embedding for ${characterId}:`, error);
    }
  }

  /**
   * Update research item with embedding
   */
  async updateResearchEmbedding(id: string, content: string): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      
      // Use raw SQL to update vector field
      await prisma.$executeRaw`
        UPDATE research_items 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error('Error updating research embedding:', error);
      throw error;
    }
  }

  /**
   * Find similar brainstorming notes using vector similarity
   */
  async findSimilarBrainstormingNotes(
    bookId: string, 
    queryText: string, 
    limit: number = 5,
    excludeId?: string
  ): Promise<Array<{ id: string; title: string; content: string; similarity: number }>> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Use raw SQL for vector similarity search
      const query = `
        SELECT 
          id,
          title,
          content,
          1 - (embedding <=> $1::vector) as similarity
        FROM brainstorming_notes 
        WHERE "bookId" = $2 
          AND embedding IS NOT NULL
          ${excludeId ? 'AND id != $4' : ''}
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;

      const params = excludeId 
        ? [JSON.stringify(queryEmbedding), bookId, limit, excludeId]
        : [JSON.stringify(queryEmbedding), bookId, limit];

      const results = await prisma.$queryRawUnsafe(query, ...params) as any[];

      return results.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      console.error('Error finding similar brainstorming notes:', error);
      return [];
    }
  }

  /**
   * Find similar characters using vector similarity
   */
  async findSimilarCharacters(
    bookId: string, 
    queryText: string, 
    limit: number = 5
  ): Promise<Array<{ id: string; name: string; description: string | null; similarity: number }>> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      const query = `
        SELECT 
          id,
          name,
          description,
          1 - (embedding <=> $1::vector) as similarity
        FROM characters 
        WHERE "bookId" = $2 
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;

      const results = await prisma.$queryRawUnsafe(
        query, 
        JSON.stringify(queryEmbedding), 
        bookId, 
        limit
      ) as any[];

      return results.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      console.error('Error finding similar characters:', error);
      return [];
    }
  }

  /**
   * Generate embeddings for all content in a book (batch operation)
   */
  async generateBookEmbeddings(bookId: string): Promise<{
    brainstormingCount: number;
    characterCount: number;
    researchCount: number;
    chapterCount: number;
    locationCount: number;
    plotPointCount: number;
    timelineEventCount: number;
    sceneCardCount: number;
  }> {
    try {
      console.log(`Starting comprehensive embedding generation for book ${bookId}`);

      // Get all content that needs embeddings (use raw queries for vector fields)
      const brainstormingNotes = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
        SELECT id, content FROM brainstorming_notes 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      const characters = await prisma.$queryRaw<Array<{ 
        id: string; 
        name: string; 
        description: string | null; 
        personality: string | null; 
        backstory: string | null 
      }>>`
        SELECT id, name, description, personality, backstory FROM characters 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      const researchItems = await prisma.$queryRaw<Array<{ id: string; content: string | null }>>`
        SELECT id, content FROM research_items 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      // NEW: Get chapters that need embeddings
      const chapters = await prisma.$queryRaw<Array<{ id: string; title: string; description: string | null; content: string }>>`
        SELECT id, title, description, content FROM chapters 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      // NEW: Get locations that need embeddings
      const locations = await prisma.$queryRaw<Array<{ 
        id: string; 
        name: string; 
        description: string | null; 
        geography: string | null; 
        culture: string | null; 
        rules: string | null 
      }>>`
        SELECT id, name, description, geography, culture, rules FROM locations 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      // NEW: Get plot points that need embeddings  
      const plotPoints = await prisma.$queryRaw<Array<{ 
        id: string; 
        type: string; 
        title: string; 
        description: string | null; 
        subplot: string | null 
      }>>`
        SELECT id, type, title, description, subplot FROM plot_points 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      // NEW: Get timeline events that need embeddings
      const timelineEvents = await prisma.$queryRaw<Array<{ 
        id: string; 
        title: string; 
        description: string | null; 
        "eventDate": string | null 
      }>>`
        SELECT id, title, description, "eventDate" FROM timeline_events 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      // NEW: Get scene cards that need embeddings
      const sceneCards = await prisma.$queryRaw<Array<{ 
        id: string; 
        title: string; 
        description: string | null; 
        purpose: string | null; 
        conflict: string | null; 
        outcome: string | null 
      }>>`
        SELECT id, title, description, purpose, conflict, outcome FROM scene_cards 
        WHERE "bookId" = ${bookId} AND embedding IS NULL
      `;

      let brainstormingCount = 0;
      let characterCount = 0;
      let researchCount = 0;
      let chapterCount = 0;
      let locationCount = 0;
      let plotPointCount = 0;
      let timelineEventCount = 0;
      let sceneCardCount = 0;

      // Process brainstorming notes
      for (const note of brainstormingNotes) {
        if (note.content?.trim()) {
          await this.updateBrainstormingEmbeddingById(note.id);
          brainstormingCount++;
        }
      }

      // Process characters
      for (const character of characters) {
        const characterText = [
          character.name,
          character.description,
          character.personality,
          character.backstory
        ].filter(Boolean).join(' ');

        if (characterText.trim()) {
          await this.updateCharacterEmbedding(character.id);
          characterCount++;
        }
      }

      // Process research items
      for (const item of researchItems) {
        if (item.content?.trim()) {
          await this.updateResearchEmbedding(item.id, item.content);
          researchCount++;
        }
      }

      // NEW: Process chapters
      for (const chapter of chapters) {
        const chapterText = [
          chapter.title,
          chapter.description,
          chapter.content?.substring(0, 4000) // Limit content to avoid token limits
        ].filter(Boolean).join('\n');

        if (chapterText.trim()) {
          await this.updateChapterEmbedding(chapter.id);
          chapterCount++;
        }
      }

      // NEW: Process locations
      for (const location of locations) {
        const locationText = [
          location.name,
          location.description,
          location.geography,
          location.culture,
          location.rules
        ].filter(Boolean).join('\n');

        if (locationText.trim()) {
          await this.updateLocationEmbedding(location.id);
          locationCount++;
        }
      }

      // NEW: Process plot points
      for (const plotPoint of plotPoints) {
        const plotText = [
          plotPoint.type,
          plotPoint.title,
          plotPoint.description,
          `Subplot: ${plotPoint.subplot || 'main'}`
        ].filter(Boolean).join('\n');

        if (plotText.trim()) {
          await this.updatePlotPointEmbedding(plotPoint.id);
          plotPointCount++;
        }
      }

      // NEW: Process timeline events
      for (const event of timelineEvents) {
        const eventText = [
          event.title,
          event.description,
          event.eventDate ? `Date: ${event.eventDate}` : null
        ].filter(Boolean).join('\n');

        if (eventText.trim()) {
          await this.updateTimelineEventEmbedding(event.id);
          timelineEventCount++;
        }
      }

      // NEW: Process scene cards
      for (const scene of sceneCards) {
        const sceneText = [
          scene.title,
          scene.description,
          scene.purpose ? `Purpose: ${scene.purpose}` : null,
          scene.conflict ? `Conflict: ${scene.conflict}` : null,
          scene.outcome ? `Outcome: ${scene.outcome}` : null
        ].filter(Boolean).join('\n');

        if (sceneText.trim()) {
          await this.updateSceneCardEmbedding(scene.id);
          sceneCardCount++;
        }
      }

      console.log(`Comprehensive embedding generation complete:
        - ${brainstormingCount} brainstorming notes
        - ${characterCount} characters  
        - ${researchCount} research items
        - ${chapterCount} chapters (BOOK CONTENT!)
        - ${locationCount} locations
        - ${plotPointCount} plot points
        - ${timelineEventCount} timeline events
        - ${sceneCardCount} scene cards`);

      return {
        brainstormingCount,
        characterCount,
        researchCount,
        chapterCount,
        locationCount,
        plotPointCount,
        timelineEventCount,
        sceneCardCount
      };
    } catch (error) {
      console.error('Error generating book embeddings:', error);
      throw error;
    }
  }

  // ===== NEW EMBEDDING FUNCTIONS FOR ADDITIONAL TABLES =====


  /**
   * Update chapter embedding
   */
  async updateChapterEmbedding(chapterId: string): Promise<void> {
    try {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        select: { title: true, description: true, content: true }
      });

      if (!chapter) return;

      // Combine title, description and FULL content for embedding (up to 8000 chars for better coverage)
      const combinedText = `${chapter.title}\n${chapter.description || ''}\n${chapter.content?.substring(0, 8000) || ''}`;
      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE chapters 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${chapterId}
      `;
    } catch (error) {
      console.error(`Error updating chapter embedding for ${chapterId}:`, error);
    }
  }

  /**
   * Update location embedding
   */
  async updateLocationEmbedding(locationId: string): Promise<void> {
    try {
      const location = await prisma.location.findUnique({
        where: { id: locationId },
        select: { name: true, description: true, geography: true, culture: true, rules: true }
      });

      if (!location) return;

      const combinedText = `${location.name}\n${location.description || ''}\n${location.geography || ''}\n${location.culture || ''}\n${location.rules || ''}`;
      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE locations 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${locationId}
      `;
    } catch (error) {
      console.error(`Error updating location embedding for ${locationId}:`, error);
    }
  }

  /**
   * Update plot point embedding
   */
  async updatePlotPointEmbedding(plotPointId: string): Promise<void> {
    try {
      const plotPoint = await prisma.plotPoint.findUnique({
        where: { id: plotPointId },
        select: { type: true, title: true, description: true, subplot: true }
      });

      if (!plotPoint) return;

      const combinedText = `${plotPoint.type} ${plotPoint.title}\n${plotPoint.description || ''}\nSubplot: ${plotPoint.subplot || 'main'}`;
      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE plot_points 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${plotPointId}
      `;
    } catch (error) {
      console.error(`Error updating plot point embedding for ${plotPointId}:`, error);
    }
  }

  /**
   * Update timeline event embedding
   */
  async updateTimelineEventEmbedding(timelineEventId: string): Promise<void> {
    try {
      const event = await prisma.timelineEvent.findUnique({
        where: { id: timelineEventId },
        select: { title: true, description: true, eventDate: true }
      });

      if (!event) return;

      const combinedText = `${event.title}\n${event.description || ''}\nDate: ${event.eventDate || ''}`;
      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE timeline_events 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${timelineEventId}
      `;
    } catch (error) {
      console.error(`Error updating timeline event embedding for ${timelineEventId}:`, error);
    }
  }

  /**
   * Update scene card embedding
   */
  async updateSceneCardEmbedding(sceneCardId: string): Promise<void> {
    try {
      const scene = await prisma.sceneCard.findUnique({
        where: { id: sceneCardId },
        select: { title: true, description: true, purpose: true, conflict: true, outcome: true }
      });

      if (!scene) return;

      const combinedText = `${scene.title}\n${scene.description || ''}\nPurpose: ${scene.purpose || ''}\nConflict: ${scene.conflict || ''}\nOutcome: ${scene.outcome || ''}`;
      const embedding = await this.generateEmbedding(combinedText);

      await prisma.$executeRaw`
        UPDATE scene_cards 
        SET embedding = ${JSON.stringify(embedding)}::vector 
        WHERE id = ${sceneCardId}
      `;
    } catch (error) {
      console.error(`Error updating scene card embedding for ${sceneCardId}:`, error);
    }
  }

  // ===== SIMILARITY SEARCH FUNCTIONS FOR NEW TABLES =====

  /**
   * Find similar chapters using vector similarity
   */
  async findSimilarChapters(bookId: string, query: string, limit: number = 5): Promise<any[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await prisma.$queryRaw<Array<{ id: string; title: string; description: string; content: string; similarity: number }>>`
        SELECT id, title, description, content,
               1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM chapters 
        WHERE "bookId" = ${bookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;
      
      return results;
    } catch (error) {
      console.error('Error finding similar chapters:', error);
      return [];
    }
  }

  /**
   * Find similar locations using vector similarity
   */
  async findSimilarLocations(bookId: string, query: string, limit: number = 5): Promise<any[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await prisma.$queryRaw<Array<{ id: string; name: string; description: string; geography: string; culture: string; similarity: number }>>`
        SELECT id, name, description, geography, culture,
               1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM locations 
        WHERE "bookId" = ${bookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;
      
      return results;
    } catch (error) {
      console.error('Error finding similar locations:', error);
      return [];
    }
  }

  /**
   * Find similar plot points using vector similarity
   */
  async findSimilarPlotPoints(bookId: string, query: string, limit: number = 5): Promise<any[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await prisma.$queryRaw<Array<{ id: string; type: string; title: string; description: string; subplot: string; similarity: number }>>`
        SELECT id, type, title, description, subplot,
               1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM plot_points 
        WHERE "bookId" = ${bookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;
      
      return results;
    } catch (error) {
      console.error('Error finding similar plot points:', error);
      return [];
    }
  }

  /**
   * Find similar timeline events using vector similarity
   */
  async findSimilarTimelineEvents(bookId: string, query: string, limit: number = 5): Promise<any[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await prisma.$queryRaw<Array<{ id: string; title: string; description: string; eventDate: string; similarity: number }>>`
        SELECT id, title, description, "eventDate",
               1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM timeline_events 
        WHERE "bookId" = ${bookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;
      
      return results;
    } catch (error) {
      console.error('Error finding similar timeline events:', error);
      return [];
    }
  }

  /**
   * Find similar scene cards using vector similarity
   */
  async findSimilarSceneCards(bookId: string, query: string, limit: number = 5): Promise<any[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await prisma.$queryRaw<Array<{ id: string; title: string; description: string; purpose: string; conflict: string; outcome: string; similarity: number }>>`
        SELECT id, title, description, purpose, conflict, outcome,
               1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM scene_cards 
        WHERE "bookId" = ${bookId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;
      
      return results;
    } catch (error) {
      console.error('Error finding similar scene cards:', error);
      return [];
    }
  }

  /**
   * Test vector similarity search functionality
   */
  async testVectorSearch(bookId: string): Promise<boolean> {
    try {
      console.log('Testing vector search functionality...');
      
      // Create a test embedding
      const testEmbedding = await this.generateEmbedding("test query");
      
      // Try a simple similarity search
      const results = await this.findSimilarBrainstormingNotes(bookId, "test", 1);
      
      console.log('Vector search test completed successfully');
      return true;
    } catch (error) {
      console.error('Vector search test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const aiEmbeddingService = new AIEmbeddingService();
