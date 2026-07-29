export const runtime = "nodejs";

// [Reason] Identity derives from the authenticated session, not client query
// params. Optional sourceUserId/limit filter refill for reviewers.
import { NextResponse } from "next/server";
import { getTasks } from "@/service/task-service";
import { requireApiUser } from "@/lib/auth/requireUser";
import { withAccessLog } from "@/lib/logger/with-access-log";

export const GET = withAccessLog(async (request: Request) => {
  try {
    const auth = await requireApiUser();
    if ("response" in auth) return auth.response;
    const { id: userId, group_id: groupId, role } = auth.user;

    if (!groupId) {
      return NextResponse.json({ error: "No group assigned" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const rawSource = searchParams.get("sourceUserId");
    const rawLimit = searchParams.get("limit");

    const sourceUserId =
      rawSource === null || rawSource === ""
        ? null
        : Number(rawSource);
    const limit =
      rawLimit === null || rawLimit === ""
        ? undefined
        : Math.floor(Number(rawLimit));

    if (sourceUserId !== null && !Number.isFinite(sourceUserId)) {
      return NextResponse.json(
        { error: "Invalid sourceUserId" },
        { status: 400 }
      );
    }
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
      return NextResponse.json(
        { error: "Limit must be a number >= 1" },
        { status: 400 }
      );
    }

    const tasks = await getTasks({
      userId,
      groupId,
      role,
      sourceUserId,
      limit,
    });
    if ((tasks as any)?.error) {
      return NextResponse.json(tasks, { status: 500 });
    }
    return NextResponse.json(tasks);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
});
