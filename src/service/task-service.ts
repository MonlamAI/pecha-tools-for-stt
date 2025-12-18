"use server";

import prisma from "@/service/db";
import { revalidatePath } from "next/cache";
import { formatTime } from "@/lib/formatTime";
import { istCurrentTime } from "@/lib/istCurrentTime";
import { TASK_RULES } from "@/constants/taskRules";
import type { Prisma, Role, Task, State } from "@prisma/client";
import { ASSIGN_TASKS, USER_FETCH_TASKS } from "@/constants/config";
import { getNumberOfAssignedTask } from "@/model/action";
import { getCache, setCache } from "@/lib/cache";

type TaskListItem = {
  id: number;
  group_id: number;
  state: State;
  inference_transcript: string | null;
  transcript: string | null;
  reviewed_transcript: string | null;
  final_transcript: string | null;
  file_name: string;
  url: string;
  transcriber: { name: string } | null;
  reviewer: { name: string } | null;
};

// // count user’s assigned but pending tasks (currently unused)
// export const getNumberOfPendingTasks = async ({
//   userId,
//   groupId,
//   role,
// }: {
//   userId: number;
//   role: Role;
//   groupId: number;
// }) => {
//   const { workingState, transcriptField, idField } = TASK_RULES[role];
//   const cacheKey = `pending:${userId}:${groupId}:${role}`;
//   const cached = getCache<number>(cacheKey);
//   if (typeof cached === "number") return cached;
//
//   const count = await prisma.task.count({
//    where: {
//       group_id: groupId,
//       state: workingState,
//       [idField]: userId,
//       [transcriptField]: null,
//       //   OR: [{ [transcriptField]: null }, { [transcriptField]: "" }],
//     },
//   });
//   // 3s TTL
//   setCache(cacheKey, count, 3000);
//   return count;
// };

export const getCompletedTaskCount = async ({
  userId,
  role,
  groupId,
}: {
  userId: number;
  role: Role;
  groupId: number;
}) => {
  const { completedStates, idField } = TASK_RULES[role];
  const statesArray = Array.isArray(completedStates) ? completedStates : [completedStates];

  return prisma.task.count({
    where: {
      [idField]: userId,
      group_id: groupId,
      state: { in: statesArray },
    },
  });
};

// fetch tasks
export const getTasks = async ({
  userId,
  groupId,
  role,
}: {
  groupId: number;
  userId: number;
  role: Role;
}): Promise<TaskListItem[]> => {
  const { workingState, idField } = TASK_RULES[role];

  // Fetch existing tasks; if none, assign and refetch.
  let tasks = (await prisma.task.findMany({
    where: { group_id: groupId, state: workingState, [idField]: userId },
    orderBy: { id: "asc" },
    take: USER_FETCH_TASKS,
    select: {
      id: true,
      group_id: true,
      state: true,
      inference_transcript: true,
      transcript: true,
      reviewed_transcript: true,
      final_transcript: true,
      file_name: true,
      url: true,
      transcriber: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
  })) as unknown as TaskListItem[];

  if (tasks.length === 0) {
    await assignTasksToUser({ groupId, userId, role });
    tasks = (await prisma.task.findMany({
      where: { group_id: groupId, state: workingState, [idField]: userId },
      orderBy: { id: "asc" },
      take: USER_FETCH_TASKS,
      select: {
        id: true,
        group_id: true,
        state: true,
        inference_transcript: true,
        transcript: true,
        reviewed_transcript: true,
        final_transcript: true,
        file_name: true,
        url: true,
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
    })) as unknown as TaskListItem[];
  }

  return tasks;
};

export const assignTasksToUser = async ({
  userId,
  groupId,
  role,
}: {
  groupId: number;
  userId: number;
  role: Role;
}): Promise<TaskListItem[]> => {
  const { workingState, idField } = TASK_RULES[role];

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // find unassigned tasks *inside the transaction*
    const unassignedTasks = await tx.task.findMany({
      where: {
        group_id: groupId,
        state: workingState,
        [idField]: null,
      },
      orderBy: { id: "asc" },
      take: ASSIGN_TASKS,
      select: {
        id: true,
        group_id: true,
        state: true,
        inference_transcript: true,
        transcript: true,
        reviewed_transcript: true,
        final_transcript: true,
        file_name: true,
        url: true,
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
    }) as unknown as TaskListItem[];

    // console.log('unassignedTasks:', unassignedTasks.length, { groupId, userId, role, workingState, idField, })
    if (unassignedTasks.length > 0) {
      await tx.task.updateMany({
        where: { id: { in: unassignedTasks.map((t) => t.id) } },
        data: { [idField]: userId },
      });
    }

    return unassignedTasks;
  });
};

// state change (data-driven)
export type TaskActionType = "submit" | "reject" | "save" | "trash" | "assign";
export const changeTaskState = ({
  task,
  role,
  action,
}: {
  task: Task;
  role: Role;
  action: TaskActionType;
}) => {
  const rules = TASK_RULES[role];

  switch (action) {
    case "assign":
    case "save":
      return { ...task, state: rules.workingState };
    case "submit":
      return { ...task, state: rules.submitState };
    case "reject":
      return { ...task, state: rules.rejectState };
    case "trash":
      return { ...task, state: rules.trashState };
    default:
      return task;
  }
};

// update DB with new state + transcript
export const updateTask = async (
  action: TaskActionType,
  id: number,
  transcript: string,
  task: Task,
  role: Role,
  currentTime: string
) => {
  const rules = TASK_RULES[role];
  const changedState = await changeTaskState({ task, role, action });
  // console.log({ rules, changedState, action, id, transcript, task, role, currentTime })
  let duration: string | null = null;

  if (["submitted", "accepted", "finalised"].includes(changedState.state)) {
    const startTime = Date.parse(currentTime);
    const endTime = Date.now();
    duration = formatTime(endTime - startTime);
  }

  // decide which fields to update
  let data: any = { state: changedState.state };

  switch (role) {
    case "TRANSCRIBER": {
      data = {
        ...data,
        transcript: changedState.state === rules.trashState ? null : transcript,
        reviewed_transcript: null,
        final_transcript: null,
        submitted_at: istCurrentTime(),
        duration,
      };
      break;
    }
    case "REVIEWER": {
      data = {
        ...data,
        transcript:
          changedState.state === rules.rejectState
            ? transcript
            : task.transcript,
        reviewed_transcript: [rules.trashState, rules.rejectState].includes(
          changedState.state
        )
          ? null
          : transcript,
        reviewed_at: istCurrentTime(),
      };
      break;
    }
    case "FINAL_REVIEWER": {
      data = {
        ...data,
        reviewed_transcript:
          changedState.state === rules.rejectState
            ? transcript
            : task.reviewed_transcript,
        final_transcript: [rules.trashState, rules.rejectState].includes(
          changedState.state
        )
          ? null
          : transcript,
        finalised_reviewed_at: istCurrentTime(),
      };
      break;
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data,
  });

  // console.log('updateTask', { updatedTask, data, id })
  if (updatedTask) {
    const shouldRevalidate =
      action === "submit" || (action as string) === "accept" || (action as string) === "finalise";
    if (shouldRevalidate) {
      revalidatePath("/stats");
      revalidatePath("/dashboard");
      revalidatePath("/report");
    }
    return { msg: taskToastMsg(action), updatedTask };
  }
  return { error: "Error updating task" };
};

// toast messages
export const taskToastMsg = (action: TaskActionType): { success: string } => {
  switch (action) {
    case "submit":
      return { success: "Task is submitted successfully" };
    case "save":
      return { success: "Task is saved successfully" };
    case "trash":
      return { success: "Task is trashed successfully" };
    case "reject":
      return { success: "Task is rejected successfully" };
    default:
      return { success: "" };
  }
};

// admin override
export const revertTaskState = async (id: number, state: string) => {
  const newState =
    state === "submitted"
      ? "transcribing"
      : state === "accepted"
        ? "submitted"
        : "accepted";

  return prisma.task.update({
    where: { id },
    data: { state: newState },
  });
};
