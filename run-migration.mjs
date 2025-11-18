import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function run() {
  try {
    // Execute each statement separately
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "brainstorming_workspaces" (
        "id" TEXT NOT NULL,
        "data" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "bookId" TEXT NOT NULL,
        CONSTRAINT "brainstorming_workspaces_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Table created');

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "brainstorming_workspaces_bookId_key" 
      ON "brainstorming_workspaces"("bookId");
    `);
    console.log('✅ Index created');

    // Check if foreign key exists before adding
    const fkExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'brainstorming_workspaces_bookId_fkey';
    `);
    
    if (!fkExists || fkExists.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "brainstorming_workspaces" 
        ADD CONSTRAINT "brainstorming_workspaces_bookId_fkey" 
        FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('✅ Foreign key created');
    } else {
      console.log('✅ Foreign key already exists');
    }
    
    // Mark the migration as applied in Prisma's migration table
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      SELECT gen_random_uuid()::text, '', NOW(), '20251113173034_add_brainstorming_workspace', NULL, NULL, NOW(), 1
      WHERE NOT EXISTS (
        SELECT 1 FROM "_prisma_migrations" 
        WHERE migration_name = '20251113173034_add_brainstorming_workspace'
      );
    `);
    console.log('✅ Migration marked as applied in Prisma!');
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('✅ Already exists, skipping.');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);

