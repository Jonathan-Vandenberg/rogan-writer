# Sync .env.local to Vercel Environment Variables

## Quick Guide

Your `.env.local` file is for **local development only**. For Vercel deployment, you need to add these same variables to **Vercel's Environment Variables dashboard**.

## Step-by-Step

### 1. Open Your .env.local File

You should see variables like:
```bash
DATABASE_URL="..."
NEXTAUTH_URL="..."
NEXTAUTH_SECRET="..."
# etc.
```

### 2. Add to Vercel Dashboard

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. For each variable in your `.env.local`:
   - Click **"Add New"**
   - **Key**: Variable name (e.g., `DATABASE_URL`)
   - **Value**: Variable value (copy from `.env.local`)
   - **Environment**: Select all (Production, Preview, Development)
   - Click **"Save"**

### 3. Required Variables (Must Have)

Make sure these are set in Vercel:

```bash
DATABASE_URL          # ⚠️ REQUIRED - Database connection string
NEXTAUTH_URL          # ⚠️ REQUIRED - Your Vercel app URL (update after first deploy)
NEXTAUTH_SECRET       # ⚠️ REQUIRED - Secret key for NextAuth
```

### 4. Optional Variables (for full functionality)

```bash
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENAI_API_KEY
XAI_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET_NAME
```

## Important Notes

1. **`.env.local` is NOT used by Vercel** - It's only for local development
2. **Vercel uses Environment Variables from dashboard** - Set them there
3. **Update `NEXTAUTH_URL`** - After first deployment, update it to your actual Vercel URL
4. **For Vercel Postgres**: Copy `POSTGRES_URL_NON_POOLING` as `DATABASE_URL`

## Quick Copy Checklist

From your `.env.local`, copy these to Vercel:

- [ ] `DATABASE_URL` → Vercel Environment Variables
- [ ] `NEXTAUTH_URL` → Vercel (update to your Vercel URL)
- [ ] `NEXTAUTH_SECRET` → Vercel
- [ ] `GOOGLE_CLIENT_ID` → Vercel (if using)
- [ ] `GOOGLE_CLIENT_SECRET` → Vercel (if using)
- [ ] `OPENAI_API_KEY` → Vercel (if using)
- [ ] `XAI_API_KEY` → Vercel (if using)
- [ ] AWS variables → Vercel (if using)

## After Adding Variables

1. **Save** all variables in Vercel dashboard
2. **Redeploy** (push to GitHub or click "Redeploy" in Vercel)
3. Build should succeed! ✅

## Troubleshooting

**Build still fails with "DATABASE_URL not found"?**

- Make sure you clicked **"Save"** after adding each variable
- Check that variables are set for **all environments** (Production, Preview, Development)
- Redeploy after adding variables

