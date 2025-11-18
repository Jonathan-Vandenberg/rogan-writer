#!/bin/bash

# Setup DATABASE_URL from Vercel Postgres environment variables
# This script ensures DATABASE_URL exists before Prisma runs

# Check if DATABASE_URL is already set
if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL is already set"
  exit 0
fi

# Try to use POSTGRES_URL_NON_POOLING (best for migrations)
if [ -n "$POSTGRES_URL_NON_POOLING" ]; then
  export DATABASE_URL="$POSTGRES_URL_NON_POOLING"
  echo "✅ Set DATABASE_URL from POSTGRES_URL_NON_POOLING"
  exit 0
fi

# Try POSTGRES_PRISMA_URL as fallback
if [ -n "$POSTGRES_PRISMA_URL" ]; then
  export DATABASE_URL="$POSTGRES_PRISMA_URL"
  echo "✅ Set DATABASE_URL from POSTGRES_PRISMA_URL"
  exit 0
fi

# No database URL found
echo "❌ ERROR: DATABASE_URL not found and no Vercel Postgres URLs available"
echo "Please set DATABASE_URL in Vercel Environment Variables"
echo "For Vercel Postgres: Copy POSTGRES_URL_NON_POOLING to DATABASE_URL"
exit 1

