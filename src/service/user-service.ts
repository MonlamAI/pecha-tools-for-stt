"use server";

import prisma from "@/service/db";
import { TASK_RULES } from "@/constants/taskRules";
import { Prisma, type Role, type State } from "@prisma/client";
import { MAX_HISTORY } from "@/constants/config";
import { getTasks } from "./task-service";
import { getCache, setCache } from "@/lib/cache";

type UserProgressStats = {
  completedTaskCount: number;
  totalTaskCount: number;
  totalTaskPassed: number;
  rejectedTaskCount: number;
};

type ProgressStatsRow = {
  completedTaskCount: number | bigint;
  totalTaskCount: number | bigint;
  totalTaskPassed: number | bigint;
  rejectedTaskCount: number | bigint;
};

// [Reason] Normalize raw COUNT aggregates (Prisma may return bigint) for JSON responses
function normalizeProgressRow(row: ProgressStatsRow | undefined): UserProgressStats {
  return {
    completedTaskCount: Number(row?.completedTaskCount ?? 0),
    totalTaskCount: Number(row?.totalTaskCount ?? 0),
    totalTaskPassed: Number(row?.totalTaskPassed ?? 0),
    rejectedTaskCount: Number(row?.rejectedTaskCount ?? 0),
  };
}

function toStateList(states: State | State[]): State[] {
  return Array.isArray(states) ? states : [states];
}

// [Reason] Build a safe IN (...) fragment for PostgreSQL State enum literals
function stateInFragment(states: State[]) {
  return Prisma.join(states.map((state) => Prisma.sql`${state}::"State"`), ", ");
}

// [Reason] One DB round trip with conditional aggregates replaces four sequential COUNT queries
async function fetchProgressStatsGrouped({
  userId,
  role,
  groupId,
}: {
  userId: number;
  role: Role;
  groupId: number;
}): Promise<UserProgressStats> {
  const rule = TASK_RULES[role];
  const completedIn = stateInFragment(toStateList(rule.completedStates));
  const passedIn = stateInFragment(toStateList(rule.passedStates));

  if (role === "TRANSCRIBER") {
    const rows = await prisma.$queryRaw<ProgressStatsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE state IN (${completedIn}))::int AS "completedTaskCount",
        COUNT(*)::int AS "totalTaskCount",
        COUNT(*) FILTER (WHERE state IN (${passedIn}))::int AS "totalTaskPassed",
        COUNT(*) FILTER (WHERE state = ${rule.workingState}::"State" AND reviewer_id IS NOT NULL)::int AS "rejectedTaskCount"
      FROM "Task"
      WHERE transcriber_id = ${userId} AND group_id = ${groupId}
    `;
    return normalizeProgressRow(rows[0]);
  }

  if (role === "REVIEWER") {
    const rows = await prisma.$queryRaw<ProgressStatsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE state IN (${completedIn}))::int AS "completedTaskCount",
        COUNT(*)::int AS "totalTaskCount",
        COUNT(*) FILTER (WHERE state IN (${passedIn}))::int AS "totalTaskPassed",
        COUNT(*) FILTER (WHERE state = ${rule.workingState}::"State" AND final_reviewer_id IS NOT NULL)::int AS "rejectedTaskCount"
      FROM "Task"
      WHERE reviewer_id = ${userId} AND group_id = ${groupId}
    `;
    return normalizeProgressRow(rows[0]);
  }

  const rows = await prisma.$queryRaw<ProgressStatsRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE state IN (${completedIn}))::int AS "completedTaskCount",
      COUNT(*)::int AS "totalTaskCount",
      COUNT(*) FILTER (WHERE state IN (${passedIn}))::int AS "totalTaskPassed",
      0::int AS "rejectedTaskCount"
    FROM "Task"
    WHERE final_reviewer_id = ${userId} AND group_id = ${groupId}
  `;
  return normalizeProgressRow(rows[0]);
}

export type FetchUserDataResult =
  | { error: string }
  | {
    userDetail: UserRecord;
    userTasks: any[];
    userHistory: any[];
  };

type UserRecord = {
  id: number;
  name: string;
  email: string;
  group_id: number;
  role: Role;
  // [Reason] Keep UserRecord aligned with Prisma User scalars after slack_user_id migration
  slack_user_id: string | null;
  group: { name: string | null } | null;
};

export async function fetchUserDataBySession(session: string): Promise<FetchUserDataResult> {
  if (!session || session === "") {
    return { error: "Invalid session" };
  }

  const userData = await getOrCreateUser({ username: session });
  if (!userData || "error" in userData) {
    return {
      error:
        userData?.error ??
        "No user found. Please try again with the correct username or email..",
    };
  }

  if (userData.group_id === 0) {
    return {
      error: "No group found. Please contact admin for assigning a group",
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

export async function getOrCreateUser({ username }: { username: string }): Promise<UserRecord | { error: string }> {
  // [Reason] Only pre-registered emails in the User table may log in; do not auto-create.
  if (!username) return { error: "Email not found. Please try again." };

  const user = await prisma.user.findUnique({
    where: { email: username },
    select: {
      id: true,
      name: true,
      email: true,
      group_id: true,
      role: true,
      // [Reason] Include slack_user_id so UserRecord matches the Prisma User type
      slack_user_id: true,
      group: {
        select: {
          name: true,
        },
      },
    },
  });

  // [Reason] Reject Google/SSO identities that were never added by an admin.
  if (!user) {
    return { error: "User is not allowed to log in." };
  }
  return user;
}

export const getUserHistory = async ({
  userId,
  groupId,
  role,
  skip = 0,
  states,
}: {
  userId: number;
  groupId: number;
  role: Role;
  skip?: number;
  states?: string | string[];
}) => {
  const rules = TASK_RULES[role];
  const queryStates = states || rules.historyStates;

  return await prisma.task.findMany({
    where: {
      [rules.idField]: userId,
      state: Array.isArray(queryStates)
        ? { in: queryStates as any }
        : (queryStates as any),
      group_id: groupId,
    },
    orderBy: [
      { finalised_reviewed_at: "desc" },
      { reviewed_at: "desc" },
      { submitted_at: "desc" },
    ],
    take: MAX_HISTORY,
    skip: skip,
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
  try {
    const cacheKey = `user_progress:${userId}:${groupId}:${role}`;
    const cached = getCache<{ completedTaskCount: number; totalTaskCount: number; totalTaskPassed: number; rejectedTaskCount?: number }>(cacheKey);
    if (cached) return cached;

    const result = await fetchProgressStatsGrouped({ userId, role, groupId });
    // 10–20s TTL: choose 15s
    setCache(cacheKey, result, 15000);
    return result;
  } catch (error) {
    console.error(`Failed to fetch progress stats for user ${userId}:`, error);
    return { error: `Failed to fetch progress stats for role ${role}. Please try again.` };
  }
};
