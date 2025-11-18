# Quick Start: Deploy to Vercel

## Fastest Path to Production

### 1. Push to GitHub
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Click "Deploy" (Vercel auto-detects Next.js)

### 3. Set Up Database

**Option A: Vercel Postgres (Easiest)**
- In Vercel project → Storage → Create Database → Postgres
- **Database is created automatically** (empty, ready for migrations)
- **pgvector extension enabled automatically** ✅
- **Schema created automatically** during build (via migrations) ✅
- Connection string auto-added as `POSTGRES_PRISMA_URL`

**Option B: External (Supabase/Neon/Railway)**
- Create **empty** PostgreSQL database
- Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Add connection string to Vercel Environment Variables
- Schema created automatically during build (via migrations) ✅

### 4. Add Environment Variables

In Vercel → Settings → Environment Variables:

```bash
# Required
DATABASE_URL="your-postgres-url"
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# Optional (for AI features)
OPENAI_API_KEY="sk-..."
XAI_API_KEY="xai-..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 5. Database Schema Creation

**✅ Happens automatically!** 

The `vercel-build` script runs `prisma migrate deploy` which:
- Creates all tables (users, books, chapters, etc.)
- Creates all indexes and foreign keys
- Sets up all enums
- **No manual steps needed!**

If you need to run migrations manually:
```bash
vercel env pull .env.local
npx prisma migrate deploy
```

### 6. Done! 🎉

Your app is live at `https://your-app.vercel.app`

---

## Quick Start: Docker (Local/Other Platforms)

### Build and Run
```bash
# Build
docker build -t rogan-writer .

# Run with docker-compose (includes database)
docker-compose up -d

# Or run standalone (requires external DB)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="your-secret" \
  rogan-writer
```

See `DEPLOYMENT.md` for detailed instructions.

