import { NextResponse } from "next/server";
import { getTaskWithRevertedState } from "@/model/task";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function POST(request: Request) {
  try {
    // [Reason] Role comes from the authenticated session, not the request body.
    const auth = await requireApiUser();
    if ("response" in auth) return auth.response;
    const role = auth.user.role;

    const { task } = await request.json();
    if (!task) {
      return NextResponse.json({ error: "Missing task" }, { status: 400 });
    }
    const updatedTask = await getTaskWithRevertedState(task, role);
    if ((updatedTask as any)?.error) {
      return NextResponse.json(updatedTask, { status: 500 });
    }
    return NextResponse.json(updatedTask);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
