import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding chat and TTS model columns...');
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "openRouterChatModel" TEXT;
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "openRouterTTSModel" TEXT;
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "ttsVoice" TEXT DEFAULT 'alloy';
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "ttsModel" TEXT DEFAULT 'tts-1';
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "editorModelTemperature" FLOAT;
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "chatModelTemperature" FLOAT;
    `;
    
    console.log('Migrating existing temperature data...');
    
    await prisma.$executeRaw`
      UPDATE "users" 
      SET "editorModelTemperature" = "defaultModelTemperature" 
      WHERE "editorModelTemperature" IS NULL AND "defaultModelTemperature" IS NOT NULL;
    `;
    
    await prisma.$executeRaw`
      UPDATE "users" 
      SET "editorModelTemperature" = 0.7 
      WHERE "editorModelTemperature" IS NULL;
    `;
    
    await prisma.$executeRaw`
      UPDATE "users" 
      SET "chatModelTemperature" = 0.7 
      WHERE "chatModelTemperature" IS NULL;
    `;
    
    console.log('✅ Successfully added chat and TTS model columns');
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

