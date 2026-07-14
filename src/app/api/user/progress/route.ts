export const runtime = "nodejs";

// [Reason] Identity (userId/groupId/role) now derives from the authenticated
// session, never from client query params, to prevent impersonation. Workflow
// logic (getUserProgressStats) is unchanged.
import { NextResponse } from "next/server";
import { getUserProgressStats } from "@/service/user-service";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if ("response" in auth) return auth.response;
    const { id: userId, group_id: groupId, role } = auth.user;

    if (!groupId) {
      return NextResponse.json({ error: "No group assigned" }, { status: 400 });
    }

    const result = await getUserProgressStats({ userId, role, groupId });
    if ((result as any)?.error) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
