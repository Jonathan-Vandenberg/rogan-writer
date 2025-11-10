import Redis from 'ioredis';

// Singleton Redis client
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  // If Redis URL is not configured, return null (graceful degradation)
  if (!process.env.REDIS_URL) {
    console.warn('⚠️ REDIS_URL not configured - caching will use in-memory fallback');
    return null;
  }

  if (!redis) {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: false, // Connect immediately to test auth
        enableOfflineQueue: true,
        // TLS is required for secure connections (Upstash, Redis Cloud)
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      });

      redis.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
      });

      redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      redis.on('ready', () => {
        console.log('✅ Redis ready to accept commands');
      });

      // Test connection on startup
      redis.ping().then(() => {
        console.log('✅ Redis PING successful');
      }).catch((err) => {
        console.error('❌ Redis PING failed:', err.message);
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      return null;
    }
  }

  return redis;
}

const CACHE_PREFIX = 'book_planning:';
const CACHE_TTL = 3600; // 1 hour in seconds

export interface CachedPlanningContext {
  context: string;
  contentHash: string;
  timestamp: number;
}

export async function getCachedPlanningContext(bookId: string): Promise<CachedPlanningContext | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const key = `${CACHE_PREFIX}${bookId}`;
    const data = await client.get(key);
    
    if (!data) {
      console.log('📦 Redis: No cache found for book:', bookId);
      return null;
    }

    const cached = JSON.parse(data) as CachedPlanningContext;
    console.log('📦 Redis: Cache hit for book:', bookId, '(age:', Math.round((Date.now() - cached.timestamp) / 1000), 'seconds)');
    return cached;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedPlanningContext(
  bookId: string, 
  context: string,
  contentHash: string
): Promise<void> {
  console.log('📝 Attempting to cache context for book:', bookId);
  const client = getRedisClient();
  if (!client) {
    console.log('❌ Redis client not available');
    return;
  }

  try {
    const key = `${CACHE_PREFIX}${bookId}`;
    const data: CachedPlanningContext = {
      context,
      contentHash,
      timestamp: Date.now()
    };

    console.log('📝 Setting Redis key:', key, 'with TTL:', CACHE_TTL, 'seconds');
    const result = await client.setex(key, CACHE_TTL, JSON.stringify(data));
    console.log('💾 Redis: Cached context for book:', bookId, '(hash:', contentHash.substring(0, 8), ', result:', result, ')');
  } catch (error) {
    console.error('❌ Redis set error:', error);
  }
}

export async function invalidatePlanningCache(bookId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const key = `${CACHE_PREFIX}${bookId}`;
    await client.del(key);
    console.log('🗑️ Redis: Invalidated cache for book:', bookId);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

export async function clearAllPlanningCaches(): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const keys = await client.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await client.del(...keys);
      console.log('🗑️ Redis: Cleared', keys.length, 'cache entries');
    }
  } catch (error) {
    console.error('Redis clear all error:', error);
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('👋 Redis connection closed');
  }
}

