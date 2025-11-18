# Database Setup Guide

## Overview

Rogan Writer uses **PostgreSQL with pgvector extension**. The database schema is created automatically via Prisma migrations.

## What Gets Created Automatically

When you deploy or run migrations, Prisma automatically creates:

✅ **All tables** (users, books, chapters, pages, etc.)  
✅ **All indexes** (for performance)  
✅ **All foreign keys** (for relationships)  
✅ **All enums** (BookStatus, CharacterRole, etc.)  
✅ **pgvector extension** (if not already enabled)

## Setup by Platform

### Vercel Postgres (Easiest)

1. **Create Database**:
   - Vercel Dashboard → Storage → Create Database → Postgres
   - Database is created automatically (empty, ready for migrations)
   - pgvector extension is enabled automatically ✅

2. **Schema Creation**:
   - Happens automatically during build via `vercel-build` script
   - Runs `prisma migrate deploy` which creates all tables
   - **No manual steps needed!**

### External PostgreSQL (Supabase, Neon, Railway, etc.)

1. **Create Empty Database**:
   ```sql
   CREATE DATABASE rogan_writer;
   ```

2. **Enable pgvector Extension**:
   ```sql
   \c rogan_writer;
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   
   **Platform-specific notes**:
   - **Supabase**: pgvector usually enabled by default
   - **Neon**: Run SQL in SQL editor
   - **Railway**: Enable in database settings/addon
   - **DigitalOcean**: Install via marketplace or manually

3. **Set Connection String**:
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/rogan_writer?schema=public"
   ```

4. **Schema Creation**:
   - Automatic via `vercel-build` script (if deploying to Vercel)
   - Or run manually: `npx prisma migrate deploy`

### Docker (Local Development)

1. **Start Database**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Database is created automatically** via `init-db.sql`:
   - Creates database `rogan_writer`
   - Enables pgvector extension
   - Sets up permissions

3. **Create Schema**:
   ```bash
   # Option 1: Push schema (development)
   npx prisma db push
   
   # Option 2: Run migrations (production-like)
   npx prisma migrate deploy
   ```

## Migration Files

All migrations are in `prisma/migrations/`:

- `00000000000000_baseline/` - Initial schema
- `20250115000000_add_openrouter_fields/` - OpenRouter support
- `20250120000000_add_temperature_fields/` - Temperature settings
- ... and more

## Verifying Database Setup

### Check Tables Exist

```bash
# Via Prisma Studio
npx prisma studio

# Or via SQL
psql $DATABASE_URL -c "\dt"
```

### Check pgvector Extension

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Check Specific Table

```sql
SELECT * FROM "users" LIMIT 1;
```

## Troubleshooting

### "Extension vector does not exist"

**Solution**: Enable pgvector:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### "Database does not exist"

**Solution**: Create empty database first:
```sql
CREATE DATABASE rogan_writer;
```

### "Relation already exists"

**Solution**: Migrations already applied. Safe to ignore or reset:
```bash
# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Or mark migrations as applied
npx prisma migrate resolve --applied <migration-name>
```

### Migrations Not Running

**Check**:
1. `DATABASE_URL` is set correctly
2. Database exists and is accessible
3. User has CREATE permissions
4. `vercel-build` script includes `prisma migrate deploy`

## Production Checklist

- [ ] Database created (empty)
- [ ] pgvector extension enabled
- [ ] `DATABASE_URL` environment variable set
- [ ] Migrations run successfully (`prisma migrate deploy`)
- [ ] Prisma Client generated (`prisma generate`)
- [ ] Can connect and query database
- [ ] All tables visible in Prisma Studio

## Quick Commands

```bash
# Generate Prisma Client
npx prisma generate

# Push schema (development)
npx prisma db push

# Run migrations (production)
npx prisma migrate deploy

# View database
npx prisma studio

# Reset database (⚠️ deletes data)
npx prisma migrate reset
```

