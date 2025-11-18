# Deployment Guide: Rogan Writer

This guide covers deploying Rogan Writer to Vercel and containerizing it with Docker.

## Table of Contents
1. [Vercel Deployment](#vercel-deployment)
2. [Docker Containerization](#docker-containerization)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [Troubleshooting](#troubleshooting)

---

## Vercel Deployment

Vercel has native Next.js support and is the recommended deployment platform.

### Prerequisites
- GitHub/GitLab/Bitbucket account
- Vercel account (free tier available)
- PostgreSQL database (Vercel Postgres or external provider)

### Step 1: Prepare Your Repository

1. Ensure all changes are committed:
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

### Step 3: Set Up Database

**Important**: The database itself must exist first (even if empty). Prisma migrations will create all tables automatically.

#### Option A: Vercel Postgres (Recommended for Vercel)

1. In your Vercel project dashboard, go to **Storage**
2. Click **Create Database** → **Postgres**
3. Choose a name and region
4. **The database is created automatically** (empty, ready for migrations)
5. Connection string is auto-added as `POSTGRES_PRISMA_URL`
6. **pgvector extension is enabled automatically** ✅

**Note**: Vercel Postgres creates an empty database. The `vercel-build` script will automatically run migrations to create all tables.

#### Option B: External PostgreSQL (e.g., Supabase, Neon, Railway)

1. **Create an empty PostgreSQL database** (the database itself, not tables)
2. **Enable pgvector extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   - Supabase: Usually enabled by default
   - Neon: Run the SQL above in SQL editor
   - Railway: Add pgvector in database settings
3. Get your connection string
4. Add it to Vercel environment variables as `DATABASE_URL`

### Step 4: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

#### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
POSTGRES_PRISMA_URL="postgresql://user:password@host:5432/database?schema=public&pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgresql://user:password@host:5432/database?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="your-secret-key-generate-with-openssl-rand-base64-32"

# OAuth (if using Google)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

#### Optional Variables (for AI features)

```bash
# OpenAI (for embeddings, TTS, Whisper)
OPENAI_API_KEY="sk-..."

# OpenRouter (if users will configure their own)
# Not required - users configure in app settings

# X.AI (for Grok)
XAI_API_KEY="xai-..."

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="your-bucket-name"

# Redis (if using)
REDIS_URL="redis://..."

# Node Environment
NODE_ENV="production"
```

### Step 5: Database Schema Creation

**The database schema (tables, indexes, etc.) is created automatically** via Prisma migrations during the build process.

#### How It Works:

1. **Vercel Build Process**:
   - Runs `npm run vercel-build` (configured in `vercel.json`)
   - Which runs: `prisma migrate deploy && next build`
   - `prisma migrate deploy` applies all migrations in `prisma/migrations/`
   - Creates all tables, indexes, constraints automatically ✅

2. **What Gets Created**:
   - All tables (users, books, chapters, etc.)
   - All indexes and foreign keys
   - Enums (BookStatus, CharacterRole, etc.)
   - pgvector extension (if not already enabled)

#### Manual Migration (if needed):

If migrations don't run automatically, run manually:

```bash
# Pull environment variables
vercel env pull .env.local

# Deploy migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Note**: The `vercel-build` script already includes this, so it should happen automatically on every deployment.

### Step 6: Enable Prisma Data Proxy (Optional but Recommended)

For better performance on Vercel:

1. Install Prisma Data Proxy:
```bash
npm install @prisma/client
```

2. Set environment variable:
```bash
PRISMA_GENERATE_DATAPROXY=true
```

3. Use connection pooling URL in production

---

## Docker Containerization

Use Docker for deploying to other platforms (AWS, Google Cloud, Azure, DigitalOcean, etc.).

### Step 1: Build Docker Image

```bash
# Build the image
docker build -t rogan-writer:latest .

# Or with docker-compose
docker-compose build
```

### Step 2: Run with Docker Compose

```bash
# Start all services (app + database)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Step 3: Run Standalone Container

```bash
# Run container (requires external database)
docker run -d \
  --name rogan-writer \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="your-secret" \
  rogan-writer:latest
```

### Step 4: Deploy to Cloud Platforms

#### AWS (ECS/Fargate)
```bash
# Tag and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker tag rogan-writer:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/rogan-writer:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/rogan-writer:latest
```

#### Google Cloud Run
```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/rogan-writer
gcloud run deploy rogan-writer --image gcr.io/PROJECT_ID/rogan-writer --platform managed
```

#### DigitalOcean App Platform
1. Connect GitHub repository
2. Select Dockerfile
3. Configure environment variables
4. Deploy

---

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Your app's public URL | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Secret for JWT signing | Generate with `openssl rand -base64 32` |

### Optional (for full functionality)

| Variable | Description | Required For |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | OpenAI API key | Embeddings, TTS, Whisper |
| `XAI_API_KEY` | X.AI API key | Grok editor agent |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Google sign-in |
| `AWS_ACCESS_KEY_ID` | AWS access key | S3 file storage |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | S3 file storage |
| `AWS_REGION` | AWS region | S3 file storage |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | S3 file storage |
| `REDIS_URL` | Redis connection string | Caching (if used) |

---

## Database Setup

### For Vercel Postgres

1. **Database is automatically created** (empty database)
2. **pgvector extension is automatically enabled**
3. **Schema is automatically created** via `vercel-build` script:
   - Runs `prisma migrate deploy` during build
   - Creates all tables, indexes, constraints
   - No manual steps needed! ✅

### For External PostgreSQL

1. **Create the database** (empty):
   ```sql
   CREATE DATABASE rogan_writer;
   ```

2. **Enable pgvector extension**:
   ```sql
   \c rogan_writer;
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Schema is created automatically** via migrations:
   - If using `vercel-build`: migrations run during build
   - Or run manually: `npx prisma migrate deploy`

4. **Generate Prisma Client** (happens automatically via `postinstall` script):
   ```bash
   npx prisma generate
   ```

---

## Troubleshooting

### Build Failures

**Issue**: Prisma Client not generated
**Solution**: Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**Issue**: Missing environment variables
**Solution**: Ensure all required env vars are set in Vercel dashboard

### Database Connection Issues

**Issue**: Connection timeout
**Solution**: 
- Use connection pooling URL (`POSTGRES_PRISMA_URL`)
- Check database firewall settings
- Verify connection string format

**Issue**: pgvector extension not found
**Solution**: Ensure database has pgvector installed:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Runtime Errors

**Issue**: "Module not found" errors
**Solution**: Ensure `node_modules` is properly installed and Prisma Client is generated

**Issue**: NextAuth errors
**Solution**: Verify `NEXTAUTH_URL` matches your deployment URL exactly (including https://)

---

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Prisma Client generated
- [ ] OAuth providers configured (if using)
- [ ] S3 bucket configured (if using file storage)
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate active (automatic on Vercel)
- [ ] Monitoring/logging set up
- [ ] Backup strategy for database

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Docker Documentation](https://docs.docker.com/)

