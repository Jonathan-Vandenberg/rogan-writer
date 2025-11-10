/**
 * Planning Context Service
 * 
 * Builds comprehensive planning context from database for AI agents
 * Ensures all book planning data fits within LLM context window with smart truncation
 */

import { prisma } from '@/lib/db';

export class PlanningContextService {
  // TOKEN BUDGET CONFIGURATION
  // GPT-4 context: 128K tokens total
  // Reserve space for: system prompt (~500), user prompt (~1000), response (~2000), existing suggestions (~2000)
  // Planning context budget: ~8000 tokens (leaves ~116K for other data)
  private static readonly MAX_PLANNING_TOKENS = 8000;
  private static readonly CHARS_PER_TOKEN = 4; // Approximate: 1 token ≈ 4 characters
  private static readonly MAX_PLANNING_CHARS = PlanningContextService.MAX_PLANNING_TOKENS * PlanningContextService.CHARS_PER_TOKEN; // ~32,000 chars

  /**
   * Build comprehensive planning context directly from database
   * This includes: plots, timelines, characters, locations, brainstorms, scenes, research, and chapter titles
   * Content is kept concise to stay below LLM context limits while providing full overview
   */
  static async buildPlanningContext(bookId: string): Promise<string> {
    console.log('📚 Building planning context from database for book:', bookId);

    // Fetch all planning data in parallel
    const [
      plotPoints,
      timelineEvents,
      characters,
      locations,
      brainstormingNotes,
      sceneCards,
      researchItems,
      chapters
    ] = await Promise.all([
      prisma.plotPoint.findMany({
        where: { bookId },
        select: { title: true, description: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.timelineEvent.findMany({
        where: { bookId },
        select: { title: true, description: true, eventDate: true },
        orderBy: { eventDate: 'asc' }
      }),
      prisma.character.findMany({
        where: { bookId },
        select: { name: true, description: true, role: true }
      }),
      prisma.location.findMany({
        where: { bookId },
        select: { name: true, description: true }
      }),
      prisma.brainstormingNote.findMany({
        where: { bookId },
        select: { title: true, content: true, tags: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sceneCard.findMany({
        where: { bookId },
        select: { title: true, description: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.researchResult.findMany({
        where: { bookId },
        select: { title: true, summary: true, tags: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.chapter.findMany({
        where: { bookId },
        select: { title: true, orderIndex: true, description: true },
        orderBy: { orderIndex: 'asc' }
      })
    ]);

    const parts: string[] = [];
    let currentLength = 0;
    
    // Helper to check if we can add more content
    const canAddContent = (additionalChars: number) => {
      return (currentLength + additionalChars) < PlanningContextService.MAX_PLANNING_CHARS;
    };
    
    // Helper to add section with budget check
    const addSection = (content: string) => {
      if (canAddContent(content.length)) {
        parts.push(content);
        currentLength += content.length + 2; // +2 for \n\n separator
        return true;
      }
      return false;
    };

    // STEP 1: Calculate total raw size to determine if truncation is needed
    const estimateRawSize = () => {
      let size = 0;
      if (plotPoints.length > 0) {
        size += plotPoints.reduce((acc, p) => acc + p.title.length + (p.description?.length || 0) + 10, 0);
      }
      if (characters.length > 0) {
        size += characters.reduce((acc, c) => acc + c.name.length + (c.description?.length || 0) + 20, 0);
      }
      if (chapters.length > 0) {
        size += chapters.reduce((acc, ch) => acc + ch.title.length + (ch.description?.length || 0) + 10, 0);
      }
      if (locations.length > 0) {
        size += locations.reduce((acc, l) => acc + l.name.length + (l.description?.length || 0) + 10, 0);
      }
      if (brainstormingNotes.length > 0) {
        size += brainstormingNotes.reduce((acc, b) => acc + b.title.length + b.content.length + 20, 0);
      }
      if (timelineEvents.length > 0) {
        size += timelineEvents.reduce((acc, t) => acc + t.title.length + (t.description?.length || 0) + 20, 0);
      }
      if (sceneCards.length > 0) {
        size += sceneCards.reduce((acc, s) => acc + (s.title?.length || 0) + (s.description?.length || 0) + 10, 0);
      }
      if (researchItems.length > 0) {
        size += researchItems.reduce((acc, r) => acc + r.title.length + (r.summary?.length || 0) + 10, 0);
      }
      return size;
    };

    const rawSize = estimateRawSize();
    const needsTruncation = rawSize > PlanningContextService.MAX_PLANNING_CHARS;
    
    console.log(`📊 Raw data size: ${rawSize} chars (~${Math.ceil(rawSize / PlanningContextService.CHARS_PER_TOKEN)} tokens)`);
    console.log(`📊 Budget: ${PlanningContextService.MAX_PLANNING_CHARS} chars (~${PlanningContextService.MAX_PLANNING_TOKENS} tokens)`);
    console.log(`📊 Truncation needed: ${needsTruncation ? 'YES' : 'NO'}`);

    // Helper to dynamically calculate truncation length based on item count and budget
    const getTruncationLength = (itemCount: number, baseLength: number): number => {
      if (!needsTruncation) return baseLength; // No truncation needed!
      
      // Apply progressive truncation only if budget is exceeded
      if (itemCount <= 10) return baseLength;
      if (itemCount <= 20) return Math.floor(baseLength * 0.7);
      if (itemCount <= 50) return Math.floor(baseLength * 0.5);
      return Math.floor(baseLength * 0.3); // For very large lists
    };

    // Priority order: Most important planning data first
    // ALL items are included, but truncated more if there are many items
    
    // 1. PLOT POINTS (highest priority - core story structure)
    if (plotPoints.length > 0) {
      const truncLen = getTruncationLength(plotPoints.length, 150);
      const plotSummary = plotPoints
        .map((p, i) => `${i + 1}. ${p.title}${p.description ? ': ' + p.description.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `🎯 PLOT POINTS (${plotPoints.length} total):\n${plotSummary}`;
      addSection(section);
    }

    // 2. CHARACTERS (critical for story)
    if (characters.length > 0) {
      const truncLen = getTruncationLength(characters.length, 120);
      const charSummary = characters
        .map((c, i) => `${i + 1}. ${c.name} (${c.role || 'No role'})${c.description ? ': ' + c.description.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `👥 CHARACTERS (${characters.length} total):\n${charSummary}`;
      addSection(section);
    }

    // 3. CHAPTER TITLES (important for understanding book scope)
    if (chapters.length > 0) {
      const truncLen = getTruncationLength(chapters.length, 80);
      const chapterTitles = chapters
        .map((ch, i) => `${i + 1}. ${ch.title}${ch.description ? ' - ' + ch.description.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `📖 CHAPTERS (${chapters.length} total - titles only):\n${chapterTitles}`;
      addSection(section);
    }

    // 4. LOCATIONS (important for world-building)
    if (locations.length > 0) {
      const truncLen = getTruncationLength(locations.length, 120);
      const locSummary = locations
        .map((l, i) => `${i + 1}. ${l.name}${l.description ? ': ' + l.description.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `📍 LOCATIONS (${locations.length} total):\n${locSummary}`;
      addSection(section);
    }

    // 5. EXISTING BRAINSTORMING IDEAS (to avoid duplicates)
    if (brainstormingNotes.length > 0) {
      const truncLen = getTruncationLength(brainstormingNotes.length, 100);
      const brainstormSummary = brainstormingNotes
        .map((b, i) => `${i + 1}. "${b.title}": ${b.content.substring(0, truncLen)}... [${b.tags.join(', ')}]`)
        .join('\n');
      const section = `💡 EXISTING BRAINSTORMING IDEAS (${brainstormingNotes.length} total):\n${brainstormSummary}`;
      addSection(section);
    }

    // 6. TIMELINE EVENTS (useful context)
    if (timelineEvents.length > 0) {
      const truncLen = getTruncationLength(timelineEvents.length, 100);
      const timelineSummary = timelineEvents
        .map((t, i) => `${i + 1}. ${t.title} (${t.eventDate || 'No date'})${t.description ? ': ' + t.description.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `📅 TIMELINE (${timelineEvents.length} total):\n${timelineSummary}`;
      addSection(section);
    }

    // 7. SCENE CARDS (detailed context)
    if (sceneCards.length > 0) {
      const truncLen = getTruncationLength(sceneCards.length, 100);
      const sceneSummary = sceneCards
        .map((s, i) => `${i + 1}. ${s.title || 'Untitled Scene'}${s.description ? ': ' + s.description.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `🎬 SCENE CARDS (${sceneCards.length} total):\n${sceneSummary}`;
      addSection(section);
    }

    // 8. RESEARCH (supplementary)
    if (researchItems.length > 0) {
      const truncLen = getTruncationLength(researchItems.length, 100);
      const researchSummary = researchItems
        .map((r, i) => `${i + 1}. ${r.title}${r.summary ? ': ' + r.summary.substring(0, truncLen) : ''}`)
        .join('\n');
      const section = `🔬 RESEARCH (${researchItems.length} total):\n${researchSummary}`;
      addSection(section);
    }

    const finalContext = parts.join('\n\n');
    const estimatedTokens = Math.ceil(finalContext.length / PlanningContextService.CHARS_PER_TOKEN);
    const budgetUsedPercent = Math.round((estimatedTokens / PlanningContextService.MAX_PLANNING_TOKENS) * 100);

    console.log(`📚 Planning context built: ${finalContext.length} chars (~${estimatedTokens}/${PlanningContextService.MAX_PLANNING_TOKENS} tokens, ${budgetUsedPercent}% of budget)`);
    console.log(`📊 Breakdown: ${plotPoints.length} plots, ${timelineEvents.length} timeline, ${characters.length} chars, ${locations.length} locs, ${brainstormingNotes.length} brainstorms, ${sceneCards.length} scenes, ${researchItems.length} research, ${chapters.length} chapters`);
    
    if (estimatedTokens > PlanningContextService.MAX_PLANNING_TOKENS) {
      console.warn(`⚠️ WARNING: Planning context exceeded budget! ${estimatedTokens} > ${PlanningContextService.MAX_PLANNING_TOKENS} tokens`);
    } else {
      console.log(`✅ Planning context within budget (${PlanningContextService.MAX_PLANNING_TOKENS - estimatedTokens} tokens remaining)`);
    }

    return parts.length > 0 
      ? finalContext
      : 'No planning data available yet. Book is in early stages.';
  }
}

export const planningContextService = new PlanningContextService();

