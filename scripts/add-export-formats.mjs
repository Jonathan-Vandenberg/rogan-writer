import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addExportFormats() {
  try {
    console.log('Adding EPUB, MOBI, and KINDLE to ExportFormat enum...')
    
    // Add new enum values
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EPUB' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ExportFormat')) THEN
          ALTER TYPE "ExportFormat" ADD VALUE 'EPUB';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MOBI' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ExportFormat')) THEN
          ALTER TYPE "ExportFormat" ADD VALUE 'MOBI';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'KINDLE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ExportFormat')) THEN
          ALTER TYPE "ExportFormat" ADD VALUE 'KINDLE';
        END IF;
      END $$;
    `)
    
    console.log('✅ Successfully added EPUB, MOBI, and KINDLE formats')
    
    // Verify
    const formats = await prisma.$queryRawUnsafe(`
      SELECT unnest(enum_range(NULL::"ExportFormat")) as format;
    `)
    console.log('Current ExportFormat values:', formats)
    
  } catch (error) {
    console.error('Error adding export formats:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addExportFormats()

