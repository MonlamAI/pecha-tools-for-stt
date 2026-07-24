export const runtime = "nodejs";

// [Reason] Identity derives from the authenticated session, not client query
// params. Task assignment/fetch logic (getTasks) is unchanged.
import { NextResponse } from "next/server";
import { getTasks } from "@/service/task-service";
import { requireApiUser } from "@/lib/auth/requireUser";
import { withAccessLog } from "@/lib/logger/with-access-log";

export const GET = withAccessLog(async () => {
  try {
    const auth = await requireApiUser();
    if ("response" in auth) return auth.response;
    const { id: userId, group_id: groupId, role } = auth.user;

    if (!groupId) {
      return NextResponse.json({ error: "No group assigned" }, { status: 400 });
    }

    const tasks = await getTasks({ userId, groupId, role });
    if ((tasks as any)?.error) {
      return NextResponse.json(tasks, { status: 500 });
    }
    return NextResponse.json(tasks);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});
