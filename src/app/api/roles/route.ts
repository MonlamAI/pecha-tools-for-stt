import { NextResponse } from "next/server";
import prisma from "@/service/db";
import type { Role } from "@prisma/client";
import { withAccessLog } from "@/lib/logger/with-access-log";

type UserRow = { email: string | null; role: Role };

export const GET = withAccessLog(async (req: Request) => {
  const key = req.headers.get("x-api-key") || "";
  if (!process.env.ROLE_SYNC_API_KEY || key !== process.env.ROLE_SYNC_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users: UserRow[] = await prisma.user.findMany({
    select: { email: true, role: true },
  });

  const rows = users
    .filter((u) => !!u.email)
    .map((u) => ({ email: u.email!, role: String(u.role) }));

  return NextResponse.json(rows, { status: 200 });
});
