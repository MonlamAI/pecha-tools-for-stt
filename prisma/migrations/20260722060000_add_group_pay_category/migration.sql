-- CreateEnum
CREATE TYPE "PayCategory" AS ENUM ('AB', 'MV', 'TT', 'GR');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "pay_category" "PayCategory" NOT NULL DEFAULT 'MV';

-- Backfill from legacy hardcoded group ID lists in calculatePay.js
UPDATE "Group" SET "pay_category" = 'AB' WHERE id IN (1, 5, 24, 26, 31);
UPDATE "Group" SET "pay_category" = 'MV' WHERE id IN (2, 3, 4, 6);
UPDATE "Group" SET "pay_category" = 'TT' WHERE id IN (11);
UPDATE "Group" SET "pay_category" = 'GR' WHERE id IN (32, 33);
