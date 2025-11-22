#!/usr/bin/env node

/**
 * Script to manually add missing OpenRouter columns to users table
 * Run this if migrations were marked as applied but didn't actually run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMissingColumns() {
  try {
    console.log('🔍 Checking for missing columns...');

    // Check and add openRouterEditorModel
    const result = await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          -- Add openRouterEditorModel column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'openRouterEditorModel'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "openRouterEditorModel" TEXT;
              RAISE NOTICE 'Added openRouterEditorModel column';
          ELSE
              RAISE NOTICE 'openRouterEditorModel column already exists';
          END IF;

          -- Add openRouterApiKey column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'openRouterApiKey'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "openRouterApiKey" TEXT;
              RAISE NOTICE 'Added openRouterApiKey column';
          ELSE
              RAISE NOTICE 'openRouterApiKey column already exists';
          END IF;

          -- Add openRouterEmbeddingModel column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'openRouterEmbeddingModel'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "openRouterEmbeddingModel" TEXT;
              RAISE NOTICE 'Added openRouterEmbeddingModel column';
          ELSE
              RAISE NOTICE 'openRouterEmbeddingModel column already exists';
          END IF;

          -- Add openRouterResearchModel column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'openRouterResearchModel'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "openRouterResearchModel" TEXT;
              RAISE NOTICE 'Added openRouterResearchModel column';
          ELSE
              RAISE NOTICE 'openRouterResearchModel column already exists';
          END IF;

          -- Add openRouterSuggestionsModel column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'openRouterSuggestionsModel'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "openRouterSuggestionsModel" TEXT;
              RAISE NOTICE 'Added openRouterSuggestionsModel column';
          ELSE
              RAISE NOTICE 'openRouterSuggestionsModel column already exists';
          END IF;

          -- Add openRouterDefaultModel column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'openRouterDefaultModel'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "openRouterDefaultModel" TEXT;
              RAISE NOTICE 'Added openRouterDefaultModel column';
          ELSE
              RAISE NOTICE 'openRouterDefaultModel column already exists';
          END IF;

          -- Add temperature columns if they don't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'defaultModelTemperature'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "defaultModelTemperature" DOUBLE PRECISION DEFAULT 0.7;
              RAISE NOTICE 'Added defaultModelTemperature column';
          ELSE
              RAISE NOTICE 'defaultModelTemperature column already exists';
          END IF;

          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'researchModelTemperature'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "researchModelTemperature" DOUBLE PRECISION DEFAULT 0.3;
              RAISE NOTICE 'Added researchModelTemperature column';
          ELSE
              RAISE NOTICE 'researchModelTemperature column already exists';
          END IF;

          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'users' 
              AND column_name = 'suggestionsModelTemperature'
          ) THEN
              ALTER TABLE "public"."users" ADD COLUMN "suggestionsModelTemperature" DOUBLE PRECISION DEFAULT 0.8;
              RAISE NOTICE 'Added suggestionsModelTemperature column';
          ELSE
              RAISE NOTICE 'suggestionsModelTemperature column already exists';
          END IF;
      END $$;
    `);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Result:', result);

    // Verify columns exist
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      AND column_name LIKE 'openRouter%' OR column_name LIKE '%Temperature'
      ORDER BY column_name;
    `);

    console.log('\n📋 OpenRouter and Temperature columns in users table:');
    console.log(columns);

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingColumns();

