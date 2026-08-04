export const runtime = "nodejs";

// [Reason] Identity derives from the authenticated session, not client query
// params. History query logic (getUserHistory) is unchanged.
import { NextResponse } from "next/server";
import { getUserHistory } from "@/service/user-service";
import { requireApiUser } from "@/lib/auth/requireUser";
import { withAccessLog } from "@/lib/logger/with-access-log";
import { TASK_RULES } from "@/constants/taskRules";

export const GET = withAccessLog(async (req: Request) => {
  try {
    const auth = await requireApiUser();
    if ("response" in auth) return auth.response;
    const { id: userId, group_id: groupId, role } = auth.user;

    if (!groupId) {
      return NextResponse.json({ error: "No group assigned" }, { status: 400 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter");
    const skip = parseInt(url.searchParams.get("skip") || "0");
    
    const rules = TASK_RULES[role];
    let states;
    if (filter === "completed") {
      states = Array.isArray(rules.historyStates) 
        ? rules.historyStates.filter(s => s !== "trashed") 
        : rules.historyStates;
    } else if (filter === "trashed") {
      states = "trashed";
    }

    const result = await getUserHistory({ userId, groupId, role, skip, states });
    return NextResponse.json(result ?? []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
});
