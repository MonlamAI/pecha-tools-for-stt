import { NextResponse } from "next/server";
import { getUserSpecificTasksCount } from "@/model/task";
import { requireFinalReviewerApi } from "@/lib/auth/requireUser";
import { withAccessLog } from "@/lib/logger/with-access-log";

export const GET = withAccessLog(async (req: Request) => {
  // [Reason] Reports are admin-only (FINAL_REVIEWER).
  const auth = await requireFinalReviewerApi();
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const isTrashed = searchParams.get("trashed") === "true";

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const data = await getUserSpecificTasksCount(id, { from, to }, null, isTrashed);
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
