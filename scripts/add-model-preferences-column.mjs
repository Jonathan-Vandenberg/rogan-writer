import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding modelPreferences column to users table...');
    
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "modelPreferences" JSONB DEFAULT '{}'::jsonb;
    `;
    
    console.log('✅ Successfully added modelPreferences column');
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

