# Vercel Environment Variables Setup

## Quick Fix for DATABASE_URL Error

If you're getting `Error: Environment variable not found: DATABASE_URL`, follow these steps:

### For Vercel Postgres Users

1. **Go to Vercel Dashboard** → Your Project → **Storage**
2. Click on your **Postgres database**
3. Go to **Settings** tab
4. You'll see these connection strings:
   - `POSTGRES_PRISMA_URL` (with connection pooling)
   - `POSTGRES_URL_NON_POOLING` (direct connection)

5. **Copy `POSTGRES_URL_NON_POOLING`** (or `POSTGRES_PRISMA_URL`)

6. **Go to** Vercel → Your Project → **Settings** → **Environment Variables**

7. **Add new variable**:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the connection string you copied
   - **Environment**: Select all (Production, Preview, Development)

8. **Save** and **redeploy**

### For External PostgreSQL Users

1. **Go to** Vercel → Your Project → **Settings** → **Environment Variables**

2. **Add**:
   - **Key**: `DATABASE_URL`
   - **Value**: Your PostgreSQL connection string
   - **Environment**: Select all

3. **Save** and **redeploy**

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

**Solution**: Add `DATABASE_URL` manually in Vercel Environment Variables (see steps above)

### "Connection refused" or "Database does not exist"

**Solution**: 
- Verify `DATABASE_URL` is correct
- Check database is created (Vercel Postgres: auto-created, External: you create it)
- Ensure database firewall allows Vercel IPs

### Migrations fail

**Solution**:
- Use `POSTGRES_URL_NON_POOLING` as `DATABASE_URL` (not `POSTGRES_PRISMA_URL`)
- Connection pooling URLs can cause issues with migrations

