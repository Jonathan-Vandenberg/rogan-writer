import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface GeneratedChapter {
  title: string;
  description: string;
  content: string;
  wordCount: number;
  orderIndex: number;
  originalIndex?: number;
}

interface SaveSelectedChaptersRequest {
  chapters: GeneratedChapter[];
  replaceExisting?: boolean;
  draftSummary?: string;
  draftStructure?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body: SaveSelectedChaptersRequest = await request.json();
    const { chapters, replaceExisting = false, draftSummary, draftStructure } = body;

    if (!chapters || chapters.length === 0) {
      return NextResponse.json({ error: 'No chapters provided' }, { status: 400 });
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      include: {
        chapters: {
          select: { id: true, title: true, orderIndex: true }
        }
      }
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check if book already has chapters and user hasn't confirmed replacement
    if (book.chapters.length > 0 && !replaceExisting) {
      return NextResponse.json({ 
        error: 'Book already has chapters', 
        existingChapters: book.chapters.length,
        requiresConfirmation: true 
      }, { status: 409 });
    }

    console.log(`Saving ${chapters.length} selected chapters to book: ${book.title}`);

    // Clear existing chapters if replacing
    if (replaceExisting || book.chapters.length > 0) {
      await prisma.chapter.deleteMany({
        where: { bookId }
      });
    }

    // Save selected chapters to database
    let totalWordCount = 0;
    const createdChapters = [];

    for (const [index, chapterData] of chapters.entries()) {
      // Use fullContent if available (from preview mode), otherwise use content
      const actualContent = (chapterData as any).fullContent || chapterData.content;
      const actualWordCount = actualContent.trim().split(/\s+/).length;
      
      // Create the chapter with sequential ordering
      const chapter = await prisma.chapter.create({
        data: {
          title: chapterData.title,
          description: chapterData.description || '',
          content: actualContent,
          orderIndex: index, // Sequential ordering (0, 1, 2...)
          wordCount: actualWordCount,
          bookId: bookId
        }
      });

      // Create pages for the chapter
      await createPagesForChapter(chapter.id, actualContent);
      
      totalWordCount += actualWordCount;
      createdChapters.push(chapter);
    }

    return NextResponse.json({
      success: true,
      bookTitle: book.title,
      chaptersCreated: chapters.length,
      totalWordCount: totalWordCount,
      structure: draftStructure || `Created ${chapters.length} chapters`,
      summary: draftSummary || 'Selected chapters from AI-generated draft',
      message: `Successfully created ${chapters.length} selected chapters with ${totalWordCount} total words`
    });

  } catch (error: any) {
    console.error('Save selected chapters error:', error);
    return NextResponse.json({ 
      error: 'Failed to save chapters', 
      details: error.message || 'Unknown error occurred' 
    }, { status: 500 });
  }
}

// Helper function to create pages for a chapter
async function createPagesForChapter(chapterId: string, content: string): Promise<void> {
  // Estimate pages based on word count (roughly 250-300 words per page)
  const wordsPerPage = 275;
  const words = content.split(/\s+/);
  const totalWords = words.length;
  const estimatedPages = Math.max(1, Math.ceil(totalWords / wordsPerPage));
  
  const pages = [];
  
  for (let pageNum = 1; pageNum <= estimatedPages; pageNum++) {
    const startWordIndex = (pageNum - 1) * wordsPerPage;
    const endWordIndex = Math.min(pageNum * wordsPerPage, totalWords);
    
    // Calculate character positions
    const startPosition = words.slice(0, startWordIndex).join(' ').length;
    const endPosition = words.slice(0, endWordIndex).join(' ').length;
    const pageWordCount = endWordIndex - startWordIndex;
    
    pages.push({
      pageNumber: pageNum,
      startPosition: startPosition,
      endPosition: endPosition,
      wordCount: pageWordCount,
      chapterId: chapterId
    });
  }

  // Create all pages in database
  if (pages.length > 0) {
    await prisma.page.createMany({
      data: pages
    });
  }
}
