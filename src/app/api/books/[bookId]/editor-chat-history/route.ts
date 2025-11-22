import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

// Lazy Redis client initialization - only create if REDIS_URL is configured
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  
  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true, // Don't connect immediately
        enableOfflineQueue: false, // Don't queue commands if offline
      });

      redis.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        // Don't crash on Redis errors
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      return null;
    }
  }
  
  return redis;
}

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

    // Get chat history from Redis (if available)
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cacheKey = `${CACHE_PREFIX}${bookId}`;
        const cachedHistory = await redisClient.get(cacheKey);

        if (cachedHistory) {
          console.log(`💬 Retrieved chat history for book ${bookId}`);
          return NextResponse.json({ messages: JSON.parse(cachedHistory) });
        }
      } catch (error) {
        console.error('Redis get error:', error);
        // Fall through to return empty array
      }
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

    // Save chat history to Redis (if available)
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cacheKey = `${CACHE_PREFIX}${bookId}`;
        await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(messages));
        console.log(`💾 Saved chat history for book ${bookId} (${messages.length} messages)`);
      } catch (error) {
        console.error('Redis set error:', error);
        // Continue anyway - chat history just won't be cached
      }
    }

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

    // Delete chat history from Redis (if available)
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cacheKey = `${CACHE_PREFIX}${bookId}`;
        await redisClient.del(cacheKey);
        console.log(`🗑️ Deleted chat history for book ${bookId}`);
      } catch (error) {
        console.error('Redis delete error:', error);
        // Continue anyway
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

