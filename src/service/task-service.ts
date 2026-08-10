"use server";

import prisma from "@/service/db";
import { formatTime } from "@/lib/formatTime";
import { TASK_RULES } from "@/constants/taskRules";
import type { Prisma, Role, Task, State } from "@prisma/client";
import { ASSIGN_TASKS, USER_FETCH_TASKS } from "@/constants/config";
import { getNumberOfAssignedTask } from "@/model/action";
import { getCache, setCache } from "@/lib/cache";
import { sendSlackMessage } from "@/lib/slack";

export type TranscriptMarks = {
  by: "REVIEWER" | "FINAL_REVIEWER";
  text: string;
  ranges: { start: number; end: number }[];
};

type TaskListItem = {
  id: number;
  group_id: number;
  state: State;
  inference_transcript: string | null;
  transcript: string | null;
  reviewed_transcript: string | null;
  final_transcript: string | null;
  transcript_marks: TranscriptMarks | null;
  is_resubmission: boolean;
  file_name: string;
  url: string;
  transcriber: { name: string } | null;
  reviewer: { name: string } | null;
};

const taskListSelect = {
  id: true,
  group_id: true,
  state: true,
  inference_transcript: true,
  transcript: true,
  reviewed_transcript: true,
  final_transcript: true,
  transcript_marks: true,
  is_resubmission: true,
  file_name: true,
  url: true,
  transcriber: { select: { name: true } },
  reviewer: { select: { name: true } },
} as const;

function normalizeTranscriptMarks(
  marks: unknown,
  transcript: string,
  role: Role
): TranscriptMarks | null {
  if (!marks || typeof marks !== "object") return null;
  const raw = marks as Partial<TranscriptMarks>;
  if (!Array.isArray(raw.ranges) || raw.ranges.length === 0) return null;
  const text = typeof raw.text === "string" ? raw.text : transcript;
  if (text !== transcript) return null;
  const len = text.length;
  const ranges = raw.ranges
    .map((r) => ({
      start: Math.max(0, Math.min(len, Number(r?.start) || 0)),
      end: Math.max(0, Math.min(len, Number(r?.end) || 0)),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (ranges.length === 0) return null;
  const by =
    role === "FINAL_REVIEWER"
      ? "FINAL_REVIEWER"
      : role === "REVIEWER"
        ? "REVIEWER"
        : null;
  if (!by) return null;
  return { by, text, ranges };
}

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

function sourceUserFilter(
  role: Role,
  sourceUserId?: number | null
): Record<string, number> {
  if (!sourceUserId) return {};
  if (role === "REVIEWER") return { transcriber_id: sourceUserId };
  if (role === "FINAL_REVIEWER") return { reviewer_id: sourceUserId };
  return {};
}

export type AssignOption = {
  id: number;
  name: string;
  availableCount: number;
};

/** Upstream users in the group with unassigned tasks ready for this role. */
export const getAssignOptions = async ({
  groupId,
  role,
  userId,
}: {
  groupId: number;
  role: Role;
  userId: number;
}): Promise<AssignOption[]> => {
  if (role !== "REVIEWER" && role !== "FINAL_REVIEWER") return [];

  const { workingState, idField } = TASK_RULES[role];
  const upstreamRole = role === "REVIEWER" ? "TRANSCRIBER" : "REVIEWER";
  const upstreamField =
    role === "REVIEWER" ? "transcriber_id" : "reviewer_id";

  const users = await prisma.user.findMany({
    where: { group_id: groupId, role: upstreamRole },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const counts = await Promise.all(
    users.map((u) =>
      prisma.task.count({
        where: {
          group_id: groupId,
          state: workingState,
          OR: [
            { [idField]: null },
            { [idField]: userId }
          ],
          [upstreamField]: u.id,
        },
      })
    )
  );

  return users
    .map((u, i) => ({
      id: u.id,
      name: u.name,
      availableCount: counts[i],
    }))
    .filter((opt) => opt.availableCount > 0);
};

// fetch tasks
export const getTasks = async ({
  userId,
  groupId,
  role,
  sourceUserId,
  limit,
}: {
  groupId: number;
  userId: number;
  role: Role;
  sourceUserId?: number | null;
  limit?: number;
}): Promise<TaskListItem[]> => {
  const { workingState, idField } = TASK_RULES[role];
  // Respect explicit Load limit (was hard-capped at USER_FETCH_TASKS=20).
  const fetchTake = limit !== undefined && limit > 0 ? limit : USER_FETCH_TASKS;
  const sourceFilter = sourceUserFilter(role, sourceUserId);

  // Fetch existing tasks; if none, assign and refetch.
  let tasks = (await prisma.task.findMany({
    where: { group_id: groupId, state: workingState, [idField]: userId, ...sourceFilter },
    orderBy: { id: "asc" },
    take: fetchTake,
    select: taskListSelect,
  })) as unknown as TaskListItem[];

  if (tasks.length === 0) {
    await assignTasksToUser({ groupId, userId, role, sourceUserId, limit });
    tasks = (await prisma.task.findMany({
      where: { group_id: groupId, state: workingState, [idField]: userId, ...sourceFilter },
      orderBy: { id: "asc" },
      take: fetchTake,
      select: taskListSelect,
    })) as unknown as TaskListItem[];
  }

  return tasks;
};

export const assignTasksToUser = async ({
  userId,
  groupId,
  role,
  sourceUserId,
  limit,
}: {
  groupId: number;
  userId: number;
  role: Role;
  sourceUserId?: number | null;
  limit?: number;
}): Promise<TaskListItem[]> => {
  const { workingState, idField } = TASK_RULES[role];
  const take = Math.max(1, limit ?? ASSIGN_TASKS);
  const sourceFilter = sourceUserFilter(role, sourceUserId);

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // find unassigned tasks *inside the transaction*
    const unassignedTasks = await tx.task.findMany({
      where: {
        group_id: groupId,
        state: workingState,
        [idField]: null,
        ...sourceFilter,
      },
      orderBy: { id: "asc" },
      take,
      select: taskListSelect,
    }) as unknown as TaskListItem[];

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
  currentTime: string,
  transcriptMarks?: TranscriptMarks | null
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

  // Use DB ids — client task payloads may omit reviewer_id / final_reviewer_id
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { reviewer_id: true, final_reviewer_id: true },
  });

  // decide which fields to update
  let data: any = { state: changedState.state };

  switch (role) {
    case "TRANSCRIBER": {
      // reviewer_id still set after a reject → this submit is a resubmission
      const isResubmission =
        action === "submit" && Boolean(existing?.reviewer_id);
      data = {
        ...data,
        transcript: changedState.state === rules.trashState ? null : transcript,
        reviewed_transcript: null,
        final_transcript: null,
        transcript_marks: null,
        is_resubmission: isResubmission,
        ...([rules.submitState, rules.trashState].includes(changedState.state)
          ? { submitted_at: new Date() }
          : {}),
        duration,
      };
      break;
    }
    case "REVIEWER": {
      const isReject = action === "reject";
      // final_reviewer_id still set after a final reject → resubmission to final
      const isResubmission =
        action === "submit" && Boolean(existing?.final_reviewer_id);
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
        transcript_marks: isReject
          ? normalizeTranscriptMarks(transcriptMarks, transcript, role)
          : null,
        // Clear when reviewer acts; set true only when re-submitting to final
        is_resubmission: isResubmission,
        ...([rules.submitState, rules.trashState].includes(changedState.state)
          ? { reviewed_at: new Date() }
          : {}),
      };
      break;
    }
    case "FINAL_REVIEWER": {
      const isReject = action === "reject";
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
        transcript_marks: isReject
          ? normalizeTranscriptMarks(transcriptMarks, transcript, role)
          : null,
        is_resubmission: false,
        ...([rules.submitState, rules.trashState].includes(changedState.state)
          ? { finalised_reviewed_at: new Date() }
          : {}),
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
    // [Reason] Alert managers when any group's transcription queue hits exactly 100 or 0
    if (action === "submit" && role === "TRANSCRIBER") {
      try {
        const group = await prisma.group.findUnique({
          where: { id: updatedTask.group_id },
          select: {
            name: true,
            notification_enabled: true,
            _count: {
              select: {
                tasks: { where: { state: "transcribing" } },
              },
            },
          },
        });

        // [Reason] Skip Slack milestones entirely when the group has notifications disabled
        if (group?.notification_enabled) {
          const remainingTasks = group._count.tasks ?? 0;
          if ([100, 0].includes(remainingTasks)) {
            const recipients = await prisma.user.findMany({
              where: {
                role: "FINAL_REVIEWER",
                slack_user_id: { not: null },
              },
              select: { slack_user_id: true },
            });

            const message =
              `📢 Group Queue Update\n\n` +
              `Group: ${group.name}\n\n` +
              `There are now ${remainingTasks} transcription tasks remaining in this group.`;

            for (const recipient of recipients) {
              const slackUserId = recipient.slack_user_id?.trim();
              if (!slackUserId) continue;
              try {
                await sendSlackMessage(slackUserId, message);
              } catch (error) {
                console.error("Failed to send Slack queue notification:", error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to send Slack queue notification:", error);
      }
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
