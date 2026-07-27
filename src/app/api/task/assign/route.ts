export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assignTasksToUser, getTasks } from "@/service/task-service";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if ("response" in auth) return auth.response;
    const { id: userId, group_id: groupId, role } = auth.user;

    if (!groupId) {
      return NextResponse.json({ error: "No group assigned" }, { status: 400 });
    }

    if (role !== "REVIEWER" && role !== "FINAL_REVIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rawLimit = Number(body?.limit);
    const limit = Number.isFinite(rawLimit) ? Math.floor(rawLimit) : NaN;
    if (!Number.isFinite(limit) || limit < 1) {
      return NextResponse.json(
        { error: "Limit must be a number >= 1" },
        { status: 400 }
      );
    }

    const rawSource = body?.sourceUserId;
    const sourceUserId =
      rawSource === null || rawSource === undefined || rawSource === ""
        ? null
        : Number(rawSource);

    if (sourceUserId !== null && !Number.isFinite(sourceUserId)) {
      return NextResponse.json(
        { error: "Invalid sourceUserId" },
        { status: 400 }
      );
    }

    const assigned = await assignTasksToUser({
      userId,
      groupId,
      role,
      sourceUserId,
      limit,
    });

    const tasks = await getTasks({
      userId,
      groupId,
      role,
      sourceUserId,
      limit,
    });

    if (assigned.length === 0 && tasks.length === 0) {
      return NextResponse.json(
        { error: "No tasks available", tasks: [], assignedCount: 0 },
        { status: 200 }
      );
    }

    return NextResponse.json({
      tasks,
      assignedCount: assigned.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}
