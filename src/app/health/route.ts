import { NextResponse } from "next/server";
import prisma from "@/service/db";

// [Reason] Health must hit the DB at request time, never during `next build` prerender
export const dynamic = "force-dynamic";

let cachedHealth: any = null;
let cachedAt = 0;

// [Reason] Longer TTL reduces load and false failures from transient DB latency
const CACHE_TTL_MS = 60_000;
// [Reason] Allow up to 3s for DB probe so brief latency spikes don't flip health to DOWN
const DB_TIMEOUT_MS = 3_000;

export async function GET() {
  const now = Date.now();

  // Return cached result if still valid (60s TTL)
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
        DB_TIMEOUT_MS
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

  // Cache result for 60 seconds
  cachedHealth = payload;
  cachedAt = now;

  return NextResponse.json(payload, {
    status: status === "UP" ? 200 : 503,
  });
}