# Redis Setup for Caching

## 📦 What's Cached in Redis?

1. **Book Planning Context** (`book_planning:{bookId}`)
   - Characters, locations, plot points, timeline, brainstorming notes
   - Used by AI agents for generating suggestions
   - TTL: 1 hour
   
2. **Editor Agent Chat History** (`editor_chat_history:{bookId}`)
   - Conversation history with the Editor Agent
   - Persists across modal open/close
   - TTL: 7 days

## 🚀 Quick Setup

### Option 1: Local Redis (Development)

1. **Install Redis:**
   ```bash
   # macOS
   brew install redis
   
   # Start Redis
   brew services start redis
   ```

2. **Add to `.env`:**
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

### Option 2: Upstash (Production - Recommended)

1. **Create Free Account:**
   - Go to https://upstash.com
   - Create a new Redis database
   - Copy the Redis URL

2. **Add to `.env`:**
   ```bash
   REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379
   ```

### Option 3: Redis Cloud

1. **Create Free Account:**
   - Go to https://redis.com/try-free
   - Create a new database
   - Copy the connection URL

2. **Add to `.env`:**
   ```bash
   REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_HOST:PORT
   ```

## 🎯 How It Works

### With Redis Configured:
```
✅ Cache persists across page refreshes
✅ Cache shared across all browser sessions
✅ Auto-expires after 1 hour
✅ Fast retrieval (<10ms)
```

### Without Redis:
```
⚠️  Graceful degradation - app works normally
❌ No caching (always performs full vector search)
```

## 🧪 Testing

1. **Start your app:**
   ```bash
   npm run dev
   ```

2. **Check console for Redis connection:**
   ```
   ✅ Redis connected
   ```

3. **Generate AI suggestions (characters, locations, scenes, etc.):**
   - First time: Full database query to build planning context
   - Second time (even after refresh): Uses Redis cache!

## 🔧 Configuration

Edit `/src/lib/redis.ts` to customize:
- `CACHE_TTL`: Cache duration (default: 3600 seconds = 1 hour)
- `CACHE_PREFIX`: Redis key prefix (default: 'book_planning:')

## 🗑️ Clear Cache

Programmatically clear cache:
```typescript
import { clearSceneCache } from '@/components/scene-cards/ai-scene-suggestions'
import { clearCharacterCache } from '@/components/characters/ai-character-suggestions'
import { clearLocationCache } from '@/components/locations/ai-location-suggestions'

// Clear specific book planning cache
await clearSceneCache(bookId)
await clearCharacterCache(bookId)
await clearLocationCache(bookId)
```

Or via API:
```bash
curl -X DELETE http://localhost:3000/api/books/BOOK_ID/book-planning-cache
```

## 📊 Monitor Cache

Check if cache exists:
```bash
curl http://localhost:3000/api/books/BOOK_ID/book-planning-cache
```

Response:
```json
{
  "cached": true,
  "contentHash": "a3f5b2c1...",
  "age": 45,
  "timestamp": 1699564800000
}
```

## 🎉 Benefits

### Performance:
- ⚡ **10x faster** - No vector search needed
- 💰 **Saves money** - Fewer OpenAI API calls
- 🔥 **Instant results** - Sub-second response time

### User Experience:
- ✅ Works across page refreshes
- ✅ Works across devices (same book)
- ✅ Auto-invalidates when content changes
- ✅ Graceful fallback if Redis unavailable

## 🐛 Troubleshooting

### Redis not connecting:
1. Check `REDIS_URL` is set in `.env`
2. Verify Redis is running: `redis-cli ping` (should return "PONG")
3. Check console for error messages

### Cache not working:
1. Check console logs for cache hit/miss
2. Verify content hash matches
3. Check cache TTL hasn't expired

### Performance issues:
1. Monitor Redis memory usage
2. Adjust TTL if needed
3. Consider Redis persistence settings

