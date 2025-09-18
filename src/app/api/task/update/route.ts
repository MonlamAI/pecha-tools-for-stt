import { NextResponse } from "next/server";
import { updateTask, getTasks } from "@/service/task-service";
import { getTranscribingCount } from "@/service/group-service";
import { sendDiscordAlert } from "@/lib/webhookutils";
import { TASK_ASSIGN } from "@/constants/config";

export async function POST(request: Request) {
  try {
    const { action, id, transcript, task, role, currentTime } = await request.json();

    if (!action || !id || !task || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // alert logic before updating the task
    const { group_id } = task;
    const taskCounts = await getTranscribingCount({ groupId: group_id });
    const count = taskCounts?._count?.tasks ?? 0;
    const groupName = taskCounts?.name ?? "Unknown Group";

    console.log({ count, groupName, TASK_ASSIGN, taskCounts })
    if (count <= TASK_ASSIGN.THRESHOLD) {
      try {
        await sendDiscordAlert({ groupName, taskCount: count, threshold: TASK_ASSIGN.THRESHOLD });
      } catch (e) {
        console.error("Failed to send Discord alert:", e);
      }
    }

    // const result = await updateTask(action, id, transcript ?? "", task, role, currentTime ?? new Date().toISOString());
    const result = await updateTask(action, id, transcript, task, role, currentTime ?? new Date().toISOString());
    if ((result as any)?.error) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
