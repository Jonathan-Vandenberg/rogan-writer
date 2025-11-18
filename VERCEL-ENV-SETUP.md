# Vercel Environment Variables Setup

## ⚠️ CRITICAL: Set DATABASE_URL BEFORE First Deployment

**You MUST set `DATABASE_URL` in Vercel Environment Variables BEFORE deploying**, otherwise the build will fail.

## Quick Setup Steps

### Step 1: Get Your Database Connection String

**For Vercel Postgres:**
1. Go to **Vercel Dashboard** → Your Project → **Storage**
2. Click on your **Postgres database**
3. Go to **Settings** tab
4. Copy the **`POSTGRES_URL_NON_POOLING`** value

**For External PostgreSQL:**
- Use your existing connection string

### Step 2: Add to Vercel Environment Variables

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add New**
3. Add these variables:

```bash
# REQUIRED - Set this FIRST!
DATABASE_URL="postgresql://..."  # Copy from POSTGRES_URL_NON_POOLING or your external DB

# REQUIRED
NEXTAUTH_URL="https://your-app.vercel.app"  # Update after first deploy
NEXTAUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32

# Optional (for OAuth)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Optional (for AI features)
OPENAI_API_KEY="sk-..."
XAI_API_KEY="xai-..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="..."
```

4. **Important**: Select **all environments** (Production, Preview, Development)
5. **Save**

### Step 3: Deploy

After setting environment variables, deploy:
- Push to GitHub (Vercel auto-deploys)
- Or click "Redeploy" in Vercel dashboard

## Automatic Fallback (If DATABASE_URL Not Set)

The build script will automatically try to use:
1. `DATABASE_URL` (if set) ✅
2. `POSTGRES_URL_NON_POOLING` (Vercel Postgres) ✅
3. `POSTGRES_PRISMA_URL` (Vercel Postgres fallback) ✅

**But it's better to set `DATABASE_URL` explicitly!**

## Complete Environment Variables Checklist

### Required (Must Have)

```bash
DATABASE_URL="postgresql://..."  # ⚠️ REQUIRED - Set this first!
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
```

### Auto-Added by Vercel Postgres (if using)

```bash
POSTGRES_PRISMA_URL="..."  # Auto-added ✅
POSTGRES_URL_NON_POOLING="..."  # Auto-added ✅
```

### Optional (for full functionality)

```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
OPENAI_API_KEY="sk-..."
XAI_API_KEY="xai-..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="..."
```

## Important Notes

1. **`DATABASE_URL` is REQUIRED** - Even if Vercel Postgres provides other URLs, Prisma needs `DATABASE_URL`
2. **Copy from `POSTGRES_URL_NON_POOLING`** - This is the direct connection (best for migrations)
3. **Set for all environments** - Production, Preview, and Development
4. **Redeploy after adding** - Changes take effect on next deployment

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

**Solution**: 
1. Add `DATABASE_URL` manually in Vercel Environment Variables
2. Copy value from `POSTGRES_URL_NON_POOLING` (if using Vercel Postgres)
3. Save and redeploy

### "Connection refused" or "Database does not exist"

**Solution**: 
- Verify `DATABASE_URL` is correct
- Check database is created (Vercel Postgres: auto-created, External: you create it)
- Ensure database firewall allows Vercel IPs

### Migrations fail

**Solution**:
- Use `POSTGRES_URL_NON_POOLING` as `DATABASE_URL` (not `POSTGRES_PRISMA_URL`)
- Connection pooling URLs can cause issues with migrations

## Local Development

For local development, create `.env.local` with:

```bash
DATABASE_URL="postgresql://rogan_user:rogan_password@localhost:5432/rogan_writer?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-local-secret"
# ... other vars
```

**Note**: `.env.local` is for local development only. Vercel uses Environment Variables from the dashboard.
