export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAssignOptions } from "@/service/task-service";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function GET() {
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

    const options = await getAssignOptions({ groupId, role, userId });
    return NextResponse.json(options);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}
