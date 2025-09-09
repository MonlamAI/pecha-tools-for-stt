"use server";

import prisma from "@/service/db";
import { TASK_RULES } from "@/constants/taskRules";
import type { Role } from "@prisma/client";
import { MAX_HISTORY } from "@/constants/config";
import { getCompletedTaskCount, getTasks } from "./task-service";

export async function fetchUserDataBySession(session: string) {
  if (!session || session === "") {
    return { error: "Invalid session" };
  }

  const userData = await getOrCreateUser({ username: session });
  if (userData === null) {
    return {
      error:
        "No user found. Please try again with the correct username or email..",
    };
  }

  if (userData.group_id === 0) {
    return {
      error: "No group found. Please contract admain for assigning a group",
    };
  }

  // console.log("fetchUserDataBySession:", { userData });
  const userTasks = await getTasks({
    userId: userData.id,
    groupId: userData.group_id,
    role: userData.role,
  });
  if (!userTasks) return { error: "No tasks found." };

  const userHistory = await getUserHistory({
    userId: userData.id,
    groupId: userData.group_id,
    role: userData.role,
  });
  if (!userHistory) return { error: "No history found." };


  return {
    userDetail: userData,
    userTasks,
    userHistory: userHistory,
  };
}

export async function getOrCreateUser({ username }: { username: string }) {
  // only allow from certain domain? uncomment below
  if (!username) return { error: "Username not found. Please try again." };
  // if (!username.endsWith("@yourdomain.com")) return { error: "Unauthorized user" };

  let user = await prisma.user.findUnique({
    where: { name: username },
    select: {
      id: true,
      name: true,
      group_id: true,
      role: true,
      group: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { name: username, email: username, group_id: 0, role: "TRANSCRIBER" },
      select: {
        id: true,
        name: true,
        group_id: true,
        role: true,
        group: {
          select: {
            name: true,
          },
        },
      },
    });
  }
  return user;
}

export const getUserHistory = async ({
  userId,
  groupId,
  role,
}: {
  userId: number;
  groupId: number;
  role: Role;
}) => {
  const rules = TASK_RULES[role];

  return await prisma.task.findMany({
    where: {
      [rules.idField]: userId,
      state: Array.isArray(rules.historyStates)
        ? { in: rules.historyStates }
        : rules.historyStates,
      group_id: groupId,
    },
    orderBy: [
      { finalised_reviewed_at: "desc" },
      { reviewed_at: "desc" },
      { submitted_at: "desc" },
    ],
    take: MAX_HISTORY,
    select: {
      id: true,
      group_id: true,
      state: true,
      inference_transcript: true,
      transcript: true,
      reviewed_transcript: true,
      final_transcript: true,
    },
  });
};

export const getUserProgressStats = async ({
  userId,
  role,
  groupId,
}: {
  userId: number;
  role: Role;
  groupId: number;
}) => {
  const rule = TASK_RULES[role];

  try {
    const [completedTaskCount, totalTaskCount, totalTaskPassed] =
      await Promise.all([
        getCompletedTaskCount({ userId, role, groupId }),
        prisma.task.count({
          where: {
            group_id: groupId,
            [rule.idField]: userId,
          },
        }),
        prisma.task.count({
          where: {
            group_id: groupId,
            [rule.idField]: userId,
            state: { in: rule.passedStates },
          },
        }),
      ]);

    return { completedTaskCount, totalTaskCount, totalTaskPassed };
  } catch (error) {
    console.error(`Failed to fetch progress stats for user ${userId}:`, error);
    return { error: `Failed to fetch progress stats for role ${role}. Please try again.` };
  }
};
