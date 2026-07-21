-- Drop generated columns that depend on transcript fields (required before ALTER TYPE)
ALTER TABLE "Task" DROP COLUMN IF EXISTS "transcriber_is_correct";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "reviewer_is_correct";

-- AlterTable: raise transcript column limits to 2500
ALTER TABLE "Task" ALTER COLUMN "inference_transcript" SET DATA TYPE VARCHAR(2500),
ALTER COLUMN "transcript" SET DATA TYPE VARCHAR(2500),
ALTER COLUMN "reviewed_transcript" SET DATA TYPE VARCHAR(2500),
ALTER COLUMN "final_transcript" SET DATA TYPE VARCHAR(2500);

-- Recreate generated columns
ALTER TABLE "Task" ADD COLUMN "transcriber_is_correct" BOOLEAN GENERATED ALWAYS AS (transcript = reviewed_transcript) STORED;
ALTER TABLE "Task" ADD COLUMN "reviewer_is_correct" BOOLEAN GENERATED ALWAYS AS (reviewed_transcript = final_transcript) STORED;
