import { NextResponse } from "next/server";
import { getUserSpecificTasks } from "@/model/task";
import { requireFinalReviewerApi } from "@/lib/auth/requireUser";
import { withAccessLog } from "@/lib/logger/with-access-log";

export const GET = withAccessLog(async (req: Request) => {
  // [Reason] Reports are admin-only (FINAL_REVIEWER).
  const auth = await requireFinalReviewerApi();
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const data = await getUserSpecificTasks(id, limit, skip, { from, to });
    if ((data as any)?.error) {
      return NextResponse.json(data, { status: 500 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
});
