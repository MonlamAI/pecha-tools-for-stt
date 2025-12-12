import { PrismaClient } from "@prisma/client";

const globalForPrisma = global;

let prismaInstance;
if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  // Try preferred pool configuration; fallback to connectionLimit for older engines
  try {
    prismaInstance = new PrismaClient({
      pool: { max: 10, min: 1 },
    });
  } catch (e) {
    try {
      prismaInstance = new PrismaClient({
        connectionLimit: 10,
      });
    } catch {
      // Final fallback: default constructor
      prismaInstance = new PrismaClient();
    }
  }
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaInstance;

export default prismaInstance;
