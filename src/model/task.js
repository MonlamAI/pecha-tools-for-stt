"use server";

import prisma from "@/service/db";
import { revalidatePath } from "next/cache";
import { splitIntoSyllables } from "./user";
import { utcToIst } from "@/lib/istCurrentTime";

/* --------------------- TASK FETCHERS --------------------- */

// Get all tasks based on pagination
export const getAllTask = async (limit, skip) => {
  try {
    return await prisma.task.findMany({
      skip,
      take: limit,
    });
  } catch (error) {
    console.error("Error getting all the tasks:", error);
    return { error: "Failed to fetch all tasks. Please try again." };
  }
};

// Get total task count with caching
export const getTotalTaskCount = async () => {
  try {
    const cacheKey = "task_total_count";
    const cached = getCache(cacheKey);
    if (typeof cached === "number") return cached;

    const totalTask = await prisma.task.count({});
    setCache(cacheKey, totalTask, 10000); // 10s TTL
    return totalTask;
  } catch (error) {
    console.error("Error fetching total task count:", error);
    return { error: "Failed to fetch task count. Please try again." };
  }
};

/* --------------------- TASK CREATION --------------------- */

export async function createTasksFromCSV(formData) {
  let tasksToCreate = [];
  try {
    const groupId = parseInt(formData.get("group_id"));
    const parsedTasksFile = JSON.parse(formData.get("tasks"));

    tasksToCreate = parsedTasksFile.map((row) => ({
      group_id: groupId,
      inference_transcript: row.inference_transcript,
      file_name: row.file_name,
      url: row.url,
      audio_duration: parseFloat(row.audio_duration),
    }));
  } catch (error) {
    console.error("Error parsing tasks file:", error);
    return { count: 0 };
  }

  try {
    const tasksCreated = await prisma.task.createMany({
      data: tasksToCreate,
      skipDuplicates: true,
    });
    revalidatePath("/dashboard/task");
    return tasksCreated;
  } catch (error) {
    console.error("Error creating tasks:", error);
    return { count: 0 };
  }
}

/* --------------------- USER SPECIFIC TASKS --------------------- */

// Get user-specific task count (optimized)
export const getUserSpecificTasksCount = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const userId = parseInt(id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return { error: `User with ID ${id} not found.` };

  const role = user.role.toLowerCase();
  const stateFilter =
    role === "transcriber"
      ? ["submitted", "accepted", "finalised"]
      : role === "reviewer"
        ? ["accepted", "finalised"]
        : ["finalised"];

  const dateField =
    role === "transcriber"
      ? "submitted_at"
      : role === "reviewer"
        ? "reviewed_at"
        : "finalised_reviewed_at";

  const whereCondition = {
    [`${role}_id`]: userId,
    state: { in: stateFilter },
    ...(fromDate && toDate && {
      [dateField]: {
        gte: utcToIst(new Date(fromDate)),
        lte: utcToIst(new Date(toDate)),
      },
    }),
  };

  try {
    return await prisma.task.count({ where: whereCondition });
  } catch (error) {
    console.error(`Error fetching tasks count for user ${id}:`, error);
    return { error: "Failed to fetch user-specific tasks count. Please try again." };
  }
};

// Get user-specific tasks (with syllable counts, optimized)
export const getUserSpecificTasks = async (id, limit, skip, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const userId = parseInt(id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return { error: `User with ID ${id} not found.` };

  const role = user.role.toLowerCase();
  const stateFilter =
    role === "transcriber"
      ? ["submitted", "accepted", "finalised"]
      : role === "reviewer"
        ? ["accepted", "finalised"]
        : ["finalised"];

  const dateField =
    role === "transcriber"
      ? "submitted_at"
      : role === "reviewer"
        ? "reviewed_at"
        : "finalised_reviewed_at";

  const whereCondition = {
    [`${role}_id`]: userId,
    state: { in: stateFilter },
    ...(fromDate && toDate && {
      [dateField]: {
        gte: utcToIst(new Date(fromDate)),
        lte: utcToIst(new Date(toDate)),
      },
    }),
  };

  try {
    const tasks = await prisma.task.findMany({
      skip,
      take: limit,
      where: whereCondition,
      orderBy: [
        { finalised_reviewed_at: "desc" },
        { reviewed_at: "desc" },
        { submitted_at: "desc" },
      ],
      select: {
        id: true,
        transcript: true,
        reviewed_transcript: true,
        inference_transcript: true,
        final_transcript: true,
        state: true,
        transcriber_is_correct: true,
        reviewer_is_correct: true,
        url: true,
        file_name: true,
        audio_duration: true,
        submitted_at: true,
        reviewed_at: true,
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
        final_reviewer: { select: { name: true } },
      },
    });

    // Compute syllable counts in batch
    return tasks.map((task) => ({
      ...task,
      transcriptSyllableCount: task.transcript ? splitIntoSyllables(task.transcript).length : 0,
      reviewedSyllableCount: task.reviewed_transcript ? splitIntoSyllables(task.reviewed_transcript).length : 0,
    }));
  } catch (error) {
    console.error(`Error fetching tasks for user ${id}:`, error);
    return { error: `Failed to fetch tasks for user with role ${user.role}.` };
  }
};

/* --------------------- USER PROGRESS --------------------- */

export const getCompletedTaskCount = async (id, role, groupId) => {
  try {
    return await prisma.task.count({
      where: {
        [`${role.toLowerCase()}_id`]: parseInt(id),
        group_id: parseInt(groupId),
        state:
          role === "TRANSCRIBER"
            ? { in: ["submitted", "accepted", "finalised"] }
            : role === "REVIEWER"
              ? { in: ["accepted", "finalised"] }
              : "finalised",
      },
    });
  } catch (error) {
    console.error(`Error fetching completed tasks for user ${id}:`, error);
    return { error: `Failed to fetch completed tasks for ${role}.` };
  }
};


export const getReviewerTaskCount = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const reviewerId = parseInt(id);

  // Construct the base query condition
  const baseWhere = {
    reviewer_id: reviewerId,
    reviewed_at:
      fromDate && toDate
        ? {
          gte: utcToIst(new Date(fromDate)),
          lte: utcToIst(new Date(toDate)),
        }
        : undefined,
  };

  try {
    // Count all reviewed tasks (either accepted or finalised)
    const reviewedStats = await prisma.task.aggregate({
      where: {
        ...baseWhere,
        state: { in: ["accepted", "finalised"] },
      },
      _count: true,
      _sum: {
        audio_duration: true,
      },
    });
    const noReviewed = reviewedStats._count || 0;
    const reviewedSecs = reviewedStats._sum.audio_duration || 0;
    // Count tasks in accepted state
    const noAccepted = await prisma.task.count({
      where: {
        ...baseWhere,
        state: "accepted",
      },
    });

    // Count tasks in finalised state
    const noFinalised = await prisma.task.count({
      where: {
        ...baseWhere,
        state: "finalised",
      },
    });

    return {
      noReviewed,
      noAccepted,
      noFinalised,
      reviewedSecs,
    };
  } catch (error) {
    console.error(`Error fetching reviewer task counts:`, error);
    return { error: `Failed to fetch reviewer task counts. Please try again.` };
  }
};

export const getFinalReviewerTaskCount = async (
  id,
  dates,
  finalReviewerObj,
  groupId
) => {
  const { from: fromDate, to: toDate } = dates;
  const finalReviewerId = parseInt(id);

  const baseWhereCondition = {
    final_reviewer_id: finalReviewerId,
    group_id: parseInt(groupId),
    finalised_reviewed_at:
      fromDate && toDate
        ? {
          gte: utcToIst(new Date(fromDate)),
          lte: utcToIst(new Date(toDate)),
        }
        : undefined,
  };

  try {
    const finalReviedStats = await prisma.task.aggregate({
      where: {
        ...baseWhereCondition,
        state: "finalised",
      },
      _count: true,
      _sum: {
        audio_duration: true,
      },
    });
    const noFinalised = finalReviedStats._count || 0;
    const finalisedSecs = finalReviedStats._sum.audio_duration || 0;
    finalReviewerObj.noFinalised = noFinalised;
    finalReviewerObj.finalisedInMin = (finalisedSecs / 60).toFixed(2);
    return finalReviewerObj;
  } catch (error) {
    console.error(`Error fetching final reviewer stats:`, error);
    return { error: "Failed to fetch final reviewer stats. Please try again." };
  }
};

export const getTranscriberTaskList = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  try {
    if (fromDate && toDate) {
      const filteredTasks = await prisma.task.findMany({
        where: {
          transcriber_id: id,
          reviewed_at: {
            gte: utcToIst(new Date(fromDate)),
            lte: utcToIst(new Date(toDate)),
          },
        },
        select: {
          inference_transcript: true,
          transcript: true,
          reviewed_transcript: true,
          state: true,
          transcriber_is_correct: true,
        },
      });
      return filteredTasks;
    } else {
      const filteredTasks = await prisma.task.findMany({
        where: {
          transcriber_id: id,
        },
        select: {
          inference_transcript: true,
          transcript: true,
          reviewed_transcript: true,
          state: true,
          transcriber_is_correct: true,
        },
      });
      return filteredTasks;
    }
  } catch (error) {
    console.error("Error fetching transcriber task list:", error);
    return { error: "Failed to fetch transcriber task list. Please try again." };
  }
};

export const getReviewerTaskList = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  try {
    if (fromDate && toDate) {
      const filteredTasks = await prisma.task.findMany({
        where: {
          reviewer_id: id,
          reviewed_at: {
            gte: utcToIst(new Date(fromDate)),
            lte: utcToIst(new Date(toDate)),
          },
        },
        select: {
          state: true,
          reviewed_transcript: true,
          final_transcript: true,
          reviewer_is_correct: true,
        },
      });
      return filteredTasks;
    } else {
      const filteredTasks = await prisma.task.findMany({
        where: {
          reviewer_id: id,
        },
        select: {
          state: true,
          reviewed_transcript: true,
          final_transcript: true,
          reviewer_is_correct: true,
        },
      });
      return filteredTasks;
    }
  } catch (error) {
    return { error: "Operation failed. Please try again." };
  }
};
export const UserProgressStats = async (id, role, groupId) => {
  try {
    const completedTaskCount = await getCompletedTaskCount(id, role, groupId);

    const totalTaskCount = await prisma.task.count({
      where: {
        [`${role.toLowerCase()}_id`]: parseInt(id),
        group_id: parseInt(groupId),
      },
    });

    const totalTaskPassed = await prisma.task.count({
      where: {
        [`${role.toLowerCase()}_id`]: parseInt(id),
        group_id: parseInt(groupId),
        state:
          role === "TRANSCRIBER" ? { in: ["accepted", "finalised"] } : "finalised",
      },
    });

    return { completedTaskCount, totalTaskCount, totalTaskPassed };
  } catch (error) {
    return { error: "Operation failed. Please try again." };
  }
};

/* --------------------- TASK STATE REVERSAL --------------------- */

export const getTaskWithRevertedState = async (task, role) => {
  try {
    let newState;
    if (task.state === "submitted" || (role === "TRANSCRIBER" && task.state === "trashed")) newState = "transcribing";
    if (task.state === "accepted" || (role === "REVIEWER" && task.state === "trashed")) newState = "submitted";
    if (task.state === "finalised" || (role === "FINAL_REVIEWER" && task.state === "trashed")) newState = "accepted";

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(task.id) },
      data: { state: newState },
      include: {
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
    });

    revalidatePath("/");
    return updatedTask;
  } catch (error) {
    console.error("Error reverting task state:", error);
    return { error: "Operation failed. Please try again." };
  }
};

/* --------------------- AGGREGATE DURATION --------------------- */

export const getUserSubmittedAndReviewedSecs = async (id, dates, groupId) => {
  const { from: fromDate, to: toDate } = dates;
  const userId = parseInt(id);

  try {
    // Aggregate all states in one query to reduce DB calls
    const stats = await prisma.task.groupBy({
      by: ["state"],
      where: {
        transcriber_id: userId,
        ...(fromDate && toDate && {
          submitted_at: { gte: utcToIst(new Date(fromDate)), lte: utcToIst(new Date(toDate)) },
        }),
        state: { in: ["submitted", "accepted", "finalised", "trashed"] },
      },
      _sum: { audio_duration: true },
    });

    let submittedSecs = 0,
      reviewedSecs = 0,
      trashedSecs = 0;

    stats.forEach((s) => {
      if (["submitted", "accepted", "finalised"].includes(s.state)) submittedSecs += s._sum.audio_duration || 0;
      if (["accepted", "finalised"].includes(s.state)) reviewedSecs += s._sum.audio_duration || 0;
      if (s.state === "trashed") trashedSecs += s._sum.audio_duration || 0;
    });

    return { submittedSecs, reviewedSecs, trashedSecs };
  } catch (error) {
    console.error(`Error aggregating user submitted seconds:`, error);
    return { error: "Failed to aggregate user submitted seconds." };
  }
};