import { PrismaClient } from "@prisma/client";

// Ensure a single PrismaClient instance in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Try supported pool options first; fall back gracefully.
  // Using any to avoid TS errors on older Prisma versions.
  const tryCreate = (opts: any) => new PrismaClient(opts as any);
  try {
    return tryCreate({ pool: { max: 10, min: 1 } });
  } catch {
    try {
      return tryCreate({ connectionLimit: 10 });
    } catch {
      return new PrismaClient();
    }
  }
}

const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

