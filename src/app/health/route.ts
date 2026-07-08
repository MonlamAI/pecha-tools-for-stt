import { NextResponse } from "next/server";
import prisma from "@/service/db";

let cachedHealth: any = null;
let cachedAt = 0;

const CACHE_TTL_MS = 10_000;

export async function GET() {
  const now = Date.now();

  // Return cached result if still valid
  if (cachedHealth && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedHealth, {
      status: cachedHealth.status === "UP" ? 200 : 503,
    });
  }

  let databaseStatus: "UP" | "DOWN" = "UP";

  try {
    console.log("Running database health check");
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Database health check timeout")),
        1000
      )
    );

    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeout,
    ]);
  } catch (error) {
    console.error("Health check database failure:", error);
    databaseStatus = "DOWN";
  }

  const status: "UP" | "DOWN" =
    databaseStatus === "UP" ? "UP" : "DOWN";

  const payload = {
    status,
    version: process.env.APP_VERSION ?? "unknown",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseStatus,
    },
  };

  // Cache result for 10 seconds
  cachedHealth = payload;
  cachedAt = now;

  return NextResponse.json(payload, {
    status: status === "UP" ? 200 : 503,
  });
}