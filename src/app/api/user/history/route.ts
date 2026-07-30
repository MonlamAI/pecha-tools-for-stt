export const runtime = "nodejs";

// [Reason] Identity derives from the authenticated session, not client query
// params. History query logic (getUserHistory) is unchanged.
import { NextResponse } from "next/server";
import { getUserHistory } from "@/service/user-service";
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

    const result = await getUserHistory({ userId, groupId, role });
    return NextResponse.json(result ?? []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
});
