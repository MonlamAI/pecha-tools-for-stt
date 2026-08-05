const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "PayCategory" ADD VALUE IF NOT EXISTS 'UK';`);
    console.log("Enum 'UK' added successfully to 'PayCategory'.");
  } catch (error) {
    console.error("Failed to add enum value:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
