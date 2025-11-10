-- AddColumn: Add audio fields to chapters table for audiobook generation
ALTER TABLE "chapters" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "chapters" ADD COLUMN "audioS3Key" TEXT;
ALTER TABLE "chapters" ADD COLUMN "audioDuration" DOUBLE PRECISION;
ALTER TABLE "chapters" ADD COLUMN "audioGenerated" TIMESTAMP(3);
ALTER TABLE "chapters" ADD COLUMN "audioStatus" TEXT NOT NULL DEFAULT 'not_generated';
ALTER TABLE "chapters" ADD COLUMN "audioError" TEXT;
ALTER TABLE "chapters" ADD COLUMN "speakerName" TEXT NOT NULL DEFAULT 'Alice';

