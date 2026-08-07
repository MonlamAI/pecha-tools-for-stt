-- AlterEnum: add UK (Uke team) pay category
-- Local DBs may already have this from a one-off script; IF NOT EXISTS is safe.
ALTER TYPE "PayCategory" ADD VALUE IF NOT EXISTS 'UK';
