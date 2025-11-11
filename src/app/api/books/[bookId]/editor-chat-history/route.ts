import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || '');

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days
const CACHE_PREFIX = 'editor_chat_history:';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

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

    // Get chat history from Redis
    const cacheKey = `${CACHE_PREFIX}${bookId}`;
    const cachedHistory = await redis.get(cacheKey);

    if (cachedHistory) {
      console.log(`💬 Retrieved chat history for book ${bookId}`);
      return NextResponse.json({ messages: JSON.parse(cachedHistory) });
    }

    return NextResponse.json({ messages: [] });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const { messages } = await request.json();

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

    // Save chat history to Redis
    const cacheKey = `${CACHE_PREFIX}${bookId}`;
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(messages));
    
    console.log(`💾 Saved chat history for book ${bookId} (${messages.length} messages)`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

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

    // Delete chat history from Redis
    const cacheKey = `${CACHE_PREFIX}${bookId}`;
    await redis.del(cacheKey);
    
    console.log(`🗑️ Deleted chat history for book ${bookId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

