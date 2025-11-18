#!/bin/bash

# Setup DATABASE_URL from Vercel Postgres environment variables
# This script ensures DATABASE_URL exists before Prisma runs
# Note: This script must be sourced (not executed) to export variables

# Set dummy OPENAI_API_KEY if not set (prevents build errors)
# The OpenAI SDK checks process.env.OPENAI_API_KEY during build analysis
# This MUST be set before any OpenAI imports are evaluated
if [ -z "$OPENAI_API_KEY" ]; then
  export OPENAI_API_KEY="sk-build-dummy-key-not-used-during-build-phase"
  echo "✅ Set OPENAI_API_KEY to dummy value for build (prevents OpenAI SDK errors)"
else
  echo "✅ OPENAI_API_KEY is already set"
fi

# Check if DATABASE_URL is already set
if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL is already set"
  return 0 2>/dev/null || exit 0
fi

# Try to use POSTGRES_URL_NON_POOLING (best for migrations)
if [ -n "$POSTGRES_URL_NON_POOLING" ]; then
  export DATABASE_URL="$POSTGRES_URL_NON_POOLING"
  echo "✅ Set DATABASE_URL from POSTGRES_URL_NON_POOLING"
  return 0 2>/dev/null || exit 0
fi

# Try POSTGRES_PRISMA_URL as fallback
if [ -n "$POSTGRES_PRISMA_URL" ]; then
  export DATABASE_URL="$POSTGRES_PRISMA_URL"
  echo "✅ Set DATABASE_URL from POSTGRES_PRISMA_URL"
  return 0 2>/dev/null || exit 0
fi

# No database URL found
echo "❌ ERROR: DATABASE_URL not found and no Vercel Postgres URLs available"
echo "Please set DATABASE_URL in Vercel Environment Variables"
echo "For Vercel Postgres: Copy POSTGRES_URL_NON_POOLING to DATABASE_URL"
return 1 2>/dev/null || exit 1

