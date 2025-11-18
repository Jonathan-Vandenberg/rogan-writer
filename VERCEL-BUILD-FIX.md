# Vercel Build Fix - OPENAI_API_KEY Error

## Problem
The build fails with: `Error: The OPENAI_API_KEY environment variable is missing or empty`

This happens because Next.js analyzes routes during build, and the OpenAI SDK checks `process.env.OPENAI_API_KEY` during module initialization.

## Solution

**Set `OPENAI_API_KEY` in Vercel Environment Variables:**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: `sk-build-dummy-key-not-used-during-build-phase` (or any dummy value)
   - **Environment**: Select all (Production, Preview, Development)
4. Save and redeploy

## Why This Works

- The OpenAI SDK checks `process.env.OPENAI_API_KEY` during build-time analysis
- Setting it in Vercel ensures it's available before Next.js starts bundling
- The dummy key prevents build errors but won't be used at runtime (if you set a real key, that will be used instead)
- The route is marked as `force-dynamic`, so it won't actually execute during build

## Alternative: Use Real API Key

If you have an OpenAI API key, you can use that instead of a dummy value. It will work for both build and runtime.

## Note

The build script (`scripts/setup-db-url.sh`) also tries to set a dummy key, but Vercel's environment variables take precedence and are more reliable.

