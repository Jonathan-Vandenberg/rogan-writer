# Deploy to Vercel - Step by Step Guide

Vercel is the easiest way to deploy Next.js applications. No GitHub Actions needed - Vercel handles everything automatically!

## Quick Start (5 minutes)

### 1. Push Your Code to GitHub

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use GitHub)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel auto-detects Next.js ✅

### 3. Configure Project Settings

Vercel will show you these settings (usually auto-detected correctly):

- **Framework Preset**: Next.js ✅
- **Root Directory**: `./` ✅
- **Build Command**: `npm run vercel-build` (already configured) ✅
- **Output Directory**: `.next` ✅
- **Install Command**: `npm install` ✅

**Important**: The `vercel-build` script runs migrations automatically!

### 4. Set Up Database

#### Option A: Vercel Postgres (Recommended)

1. In the project setup, click **"Create Database"** → **Postgres**
2. Choose a name and region
3. **Database is created automatically** ✅
4. Connection strings are auto-added:
   - `POSTGRES_PRISMA_URL` (for Prisma with connection pooling)
   - `POSTGRES_URL_NON_POOLING` (direct connection)
   - `DATABASE_URL` (may need to be set manually - see below)

**Important**: After creating the database, check if `DATABASE_URL` was auto-added. If not:
1. Go to Vercel → Storage → Your Database → Settings
2. Copy the connection string
3. Add it as `DATABASE_URL` in Environment Variables
4. Or use `POSTGRES_URL_NON_POOLING` as `DATABASE_URL`

#### Option B: External PostgreSQL

1. Create database on Supabase/Neon/Railway
2. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Copy connection string
4. Add to Vercel environment variables (see step 5)

### 5. Add Environment Variables

In Vercel project settings → **Environment Variables**, add:

#### Required Variables

```bash
# Database (if using external PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-app.vercel.app"  # Update after first deploy!
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# OAuth (if using Google)
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

#### Optional Variables (for AI features)

```bash
OPENAI_API_KEY="sk-..."
XAI_API_KEY="xai-..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="your-bucket"
```

**Note**: 
- For Vercel Postgres, `DATABASE_URL` is auto-added
- Set `NEXTAUTH_URL` after first deployment (get URL from Vercel)
- Add variables for **Production**, **Preview**, and **Development** environments

### 6. Deploy!

Click **"Deploy"** and wait ~2-3 minutes.

**What happens automatically:**
1. ✅ Installs dependencies (`npm install`)
2. ✅ Generates Prisma Client (`postinstall` script)
3. ✅ Runs migrations (`prisma migrate deploy` via `vercel-build`)
4. ✅ Builds Next.js app (`next build`)
5. ✅ Deploys to production

### 7. Update NEXTAUTH_URL

After first deployment:

1. Copy your Vercel URL: `https://your-app.vercel.app`
2. Go to Vercel → Settings → Environment Variables
3. Update `NEXTAUTH_URL` to your actual URL
4. Redeploy (or it will auto-redeploy on next push)

## Automatic Deployments

Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every pull request
- **Development**: Every push to other branches (optional)

## Database Migrations

Migrations run automatically via the `vercel-build` script:

```json
{
  "scripts": {
    "vercel-build": "prisma migrate deploy && next build"
  }
}
```

This means:
- ✅ All tables are created automatically
- ✅ Schema updates are applied automatically
- ✅ No manual migration steps needed!

## Custom Domain

1. Go to Vercel → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable

## Environment Variables by Environment

You can set different values for:
- **Production**: Live site
- **Preview**: Pull request previews
- **Development**: Local development (via `.env.local`)

## Monitoring & Logs

- **Deployments**: Vercel Dashboard → Deployments
- **Logs**: Click any deployment → View Function Logs
- **Analytics**: Vercel Dashboard → Analytics (if enabled)

## Troubleshooting

### Build Fails

**Check**:
1. Environment variables are set correctly
2. Database is accessible
3. `DATABASE_URL` is correct
4. Check build logs in Vercel dashboard

### Database Connection Errors

**Solution**:
- Verify `DATABASE_URL` is set
- Check database firewall allows Vercel IPs
- For Vercel Postgres: Connection string is auto-added

### Migrations Not Running

**Solution**:
- Check `vercel.json` has `"buildCommand": "npm run vercel-build"`
- Check build logs for migration output
- Run manually: `vercel env pull .env.local && npx prisma migrate deploy`

### NEXTAUTH_URL Errors

**Solution**:
- Must match your Vercel URL exactly (including `https://`)
- Update after first deployment
- Redeploy after changing

## What Gets Deployed

Vercel automatically:
- ✅ Builds your Next.js app
- ✅ Runs Prisma migrations
- ✅ Generates Prisma Client
- ✅ Optimizes images
- ✅ Sets up CDN
- ✅ Handles SSL certificates
- ✅ Provides analytics

## Cost

- **Free Tier**: 
  - Unlimited deployments
  - 100GB bandwidth/month
  - Perfect for most projects
- **Pro Tier**: $20/month
  - More bandwidth
  - Team features
  - Better analytics

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Set up custom domain (optional)
3. ✅ Configure monitoring
4. ✅ Set up preview deployments for PRs
5. ✅ Add CI/CD checks (see `.github/workflows/deploy-production.yml`)

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://nextjs.org/docs/deployment)
- [Prisma on Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

