import { NextResponse } from "next/server";
import { getTaskWithRevertedState } from "@/model/task";

export async function POST(request: Request) {
  try {
    const { task, role } = await request.json();
    if (!task || !role) {
      return NextResponse.json({ error: "Missing task or role" }, { status: 400 });
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
