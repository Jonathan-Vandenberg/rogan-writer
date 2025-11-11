import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unifiedEmbeddingService } from '@/services/unified-embedding.service';
import { countWords } from '@/lib/word-utils';

interface ApplyChangesRequest {
  changes: Array<{
    chapterId: string;
    newContent: string;
  }>;
  newChapters?: Array<{
    title: string;
    content: string;
    orderIndex: number;
  }>;
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
    const body: ApplyChangesRequest = await request.json();
    const { changes, newChapters } = body;

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const updatedChapters = [];
    const createdChapters = [];

    // Apply edits to existing chapters
    if (changes && changes.length > 0) {
      for (const change of changes) {
        const wordCount = countWords(change.newContent);
        
        const updated = await prisma.chapter.update({
          where: { id: change.chapterId },
          data: {
            content: change.newContent,
            wordCount,
            updatedAt: new Date(),
          },
        });

        updatedChapters.push(updated);

        // Update embeddings for the chapter
        try {
          await unifiedEmbeddingService.updateSourceEmbeddings({
            bookId,
            sourceId: change.chapterId,
            sourceType: 'chapter',
            content: change.newContent,
            metadata: {
              title: updated.title,
              orderIndex: updated.orderIndex,
              chapterNumber: updated.orderIndex + 1,
            },
          });
        } catch (embeddingError) {
          console.error('Failed to update embeddings for chapter:', change.chapterId, embeddingError);
          // Continue even if embedding update fails
        }
      }
    }

    // Create new chapters
    if (newChapters && newChapters.length > 0) {
      for (const newChapter of newChapters) {
        const wordCount = countWords(newChapter.content);
        
        const created = await prisma.chapter.create({
          data: {
            title: newChapter.title,
            content: newChapter.content,
            orderIndex: newChapter.orderIndex,
            wordCount,
            bookId,
          },
        });

        createdChapters.push(created);

        // Create embeddings for new chapter
        try {
          await unifiedEmbeddingService.updateSourceEmbeddings({
            bookId,
            sourceId: created.id,
            sourceType: 'chapter',
            content: newChapter.content,
            metadata: {
              title: created.title,
              orderIndex: created.orderIndex,
              chapterNumber: created.orderIndex + 1,
            },
          });
        } catch (embeddingError) {
          console.error('Failed to create embeddings for new chapter:', created.id, embeddingError);
          // Continue even if embedding creation fails
        }
      }
    }

    // Update book's updatedAt timestamp
    await prisma.book.update({
      where: { id: bookId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      updatedChapters,
      createdChapters,
      message: `Successfully applied ${changes?.length || 0} edits and created ${newChapters?.length || 0} new chapters.`,
    });
  } catch (error) {
    console.error('Error applying editor changes:', error);
    return NextResponse.json(
      { error: 'Failed to apply changes' },
      { status: 500 }
    );
  }
}

