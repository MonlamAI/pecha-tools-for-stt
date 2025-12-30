"use server";

import prisma from "@/service/db";
import { revalidatePath } from "next/cache";
import {
  getFinalReviewerTaskCount,
  getReviewerTaskCount,
  getReviewerTaskList,
  getTranscriberTaskList,
  getUserSpecificTasksCount,
  getUserSubmittedAndReviewedSecs,
} from "./task";
import { utcToIst } from "@/lib/istCurrentTime";

const levenshtein = require("fast-levenshtein");

/* -------------------- USERS -------------------- */

// Get all users with counts and group info
export const getAllUser = async () => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            transcriber_task: true,
            reviewer_task: true,
            final_reviewer_task: true,
          },
        },
        group: true,
      },
      orderBy: { id: "asc" },
    });
    return users;
  } catch (error) {
    console.error("Error getting all the users:", error);
    throw new Error(error);
  }
};

// Create new user
export const createUser = async (_prevState, formData) => {
  const name = formData.get("name")?.trim();
  const email = formData.get("email")?.trim();
  const groupId = formData.get("group_id");
  const role = formData.get("role");

  try {
    // Check for duplicates
    const [userByName, userByEmail] = await Promise.all([
      prisma.user.findFirst({ where: { name } }),
      prisma.user.findFirst({ where: { email } }),
    ]);

    if (userByName && userByEmail) return { error: "User already exists with the same username and email" };
    if (userByName) return { error: "User already exists with the same username" };
    if (userByEmail) return { error: "User already exists with the same email" };

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        group_id: parseInt(groupId),
        role,
      },
    });

    revalidatePath("/dashboard/user");
    return newUser ? { success: "User created successfully" } : { error: "Error creating user" };
  } catch (error) {
    console.error("Error adding a user:", error);
    if (error?.code === "P2002") return { error: "Duplicate username or email" };
    return { error: "Failed to create user. Please try again." };
  }
};

// Delete user
export const deleteUser = async (id) => {
  try {
    const taskCount = await prisma.task.count({
      where: {
        OR: [
          { transcriber_id: id },
          { reviewer_id: id },
          { final_reviewer_id: id },
        ],
      },
    });

    if (taskCount > 0) {
      return {
        error: `Cannot delete user. They have ${taskCount} associated task(s). Please reassign or complete these tasks first.`,
      };
    }

    await prisma.user.delete({ where: { id } });
    revalidatePath("/dashboard/user");
    return { success: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting a user:", error);
    return { error: "Failed to delete user. Please try again." };
  }
};

// Delete user via FormData
export const deleteUserByForm = async (_prevState, formData) => {
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" ? parseInt(idRaw) : Number(idRaw);
  if (!id || Number.isNaN(id)) return { error: "Invalid user id" };
  return deleteUser(id);
};

// Edit user
export const editUser = async (id, formData) => {
  const name = formData.get("name")?.trim();
  const email = formData.get("email")?.trim();
  const groupId = formData.get("group_id");
  const role = formData.get("role");
  const userId = parseInt(id);

  try {
    const [userByName, userByEmail] = await Promise.all([
      prisma.user.findFirst({ where: { name, NOT: { id: userId } } }),
      prisma.user.findFirst({ where: { email, NOT: { id: userId } } }),
    ]);

    if (userByName && userByEmail) return { error: "User already exists with the same username and email" };
    if (userByName) return { error: "User already exists with the same username" };
    if (userByEmail) return { error: "User already exists with the same email" };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, email, group_id: parseInt(groupId), role },
    });

    revalidatePath("/dashboard/user");
    return updatedUser ? { success: "User edited successfully" } : { error: "Error editing user" };
  } catch (error) {
    console.error("Error updating user details:", error);
    if (error?.code === "P2002") return { error: "Duplicate username or email" };
    return { error: "Failed to update user. Please try again." };
  }
};

// Edit user via FormData
export const editUserByForm = async (_prevState, formData) => {
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" ? parseInt(idRaw) : Number(idRaw);
  if (!id || Number.isNaN(id)) return { error: "Invalid user id" };
  return editUser(id, formData);
};

// Get users of a group (transcribers)
export const getUsersByGroup = async (groupId) => {
  try {
    const users = await prisma.user.findMany({
      where: { group_id: parseInt(groupId), role: "TRANSCRIBER" },
    });
    return users;
  } catch (error) {
    console.error("Error getting users by group:", error);
    throw new Error(error);
  }
};

/* -------------------- REPORTS -------------------- */

// Generate full report for group
export const generateUserReportByGroup = async (groupId, dates) => {
  try {
    const users = await getUsersByGroup(groupId);
    if (!users || !users.length) return [];

    const reports = await Promise.all(
      users.map((user) => generateUsersTaskReport(user, dates, groupId))
    );

    return reports;
  } catch (error) {
    console.error("Error generating transcriber report by group:", error);
    throw new Error("Failed to generate transcriber report.");
  }
};

// Generate report for a single user
export const generateUsersTaskReport = async (user, dates, groupId) => {
  const { id: userId, name } = user;

  const [
    submittedTaskCount,
    { submittedSecs, reviewedSecs, trashedSecs },
    userTasks,
    reviewedTaskCount,
    transcriberSyllableCount,
    transcriberCer,
  ] = await Promise.all([
    getUserSpecificTasksCount(userId, dates),
    getUserSubmittedAndReviewedSecs(userId, dates, groupId),
    getTranscriberTaskList(userId, dates),
    getReviewedCountBasedOnSubmittedAt(userId, dates, groupId),
    getTranscriberSyllableCount(userId, dates),
    getTranscriberCer(userId, dates),
  ]);

  const transcriberObj = {
    id: userId,
    name,
    noSubmitted: submittedTaskCount,
    noReviewedBasedOnSubmitted: reviewedTaskCount || 0,
    noReviewed: 0,
    submittedInMin: parseFloat((submittedSecs / 60).toFixed(2) || 0),
    reviewedInMin: parseFloat((reviewedSecs / 60).toFixed(2) || 0),
    trashedInMin: parseFloat((trashedSecs / 60).toFixed(2) || 0),
    syllableCount: 0,
    transcriberSyllableCount: transcriberSyllableCount || 0,
    transcriberCer: transcriberCer || 0,
    noTranscriptCorrected: 0,
    characterCount: 0,
    cer: 0,
    totalCer: 0,
  };

  return UserTaskReport(transcriberObj, userTasks);
};

/* -------------------- UTILITIES -------------------- */

// Compute CER for user
const getTranscriberCer = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const transcriberId = parseInt(id);

  const dateFilter = buildDateFilter(fromDate, toDate);

  try {
    const tasks = await prisma.task.findMany({
      where: { transcriber_id: transcriberId, ...dateFilter },
      select: { inference_transcript: true, transcript: true },
    });

    return tasks.reduce((acc, task) => {
      if (task.transcript && task.inference_transcript) {
        acc += levenshtein.get(task.inference_transcript, task.transcript);
      }
      return acc;
    }, 0);
  } catch (error) {
    console.error("Error getting transcriber CER:", error);
    return 0;
  }
};

// Count Tibetan syllables for user
function tibetanSyllableCount(text) {
  if (!text) return 0;
  return text
    .replace(/[^\u0F00-\u0FFF]+/g, "")
    .split(/[་།]/)
    .filter(Boolean).length;
}

const getTranscriberSyllableCount = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const transcriberId = parseInt(id);
  const dateFilter = buildDateFilter(fromDate, toDate);

  try {
    const tasks = await prisma.task.findMany({
      where: {
        transcriber_id: transcriberId,
        state: { in: ["submitted", "accepted", "finalised"] },
        ...dateFilter,
      },
    });

    return tasks.reduce((count, task) => count + tibetanSyllableCount(task.transcript), 0);
  } catch (error) {
    console.error("Error getting transcriber syllable count:", error);
    return 0;
  }
}

// Build date filter
const buildDateFilter = (fromDate, toDate) =>
  fromDate && toDate
    ? { submitted_at: { gte: utcToIst(new Date(fromDate)), lte: utcToIst(new Date(toDate)) } }
    : {};

// Count reviewed tasks based on submitted_at
export const getReviewedCountBasedOnSubmittedAt = async (id, dates, groupId) => {
  const { from: fromDate, to: toDate } = dates;
  const transcriberId = parseInt(id);

  const dateFilter = buildDateFilter(fromDate, toDate);

  try {
    const count = await prisma.task.count({
      where: { transcriber_id: transcriberId, state: { in: ["accepted", "finalised"] }, ...dateFilter },
    });
    return count;
  } catch (error) {
    console.error("Error getting reviewed and finalised task count:", error);
    throw new Error("Error fetching task counts.");
  }
};

// Generate task report summary
export const UserTaskReport = (transcriberObj, userTasks) =>
  userTasks.reduce((acc, task) => {
    if (["accepted", "finalised"].includes(task.state)) {
      acc.noReviewed++;
      acc.syllableCount += tibetanSyllableCount(task.reviewed_transcript);
      acc.characterCount += task.transcript?.length || 0;
      if (task.transcript && task.reviewed_transcript) {
        acc.totalCer += levenshtein.get(task.transcript, task.reviewed_transcript);
      }
    }
    if (task.transcriber_is_correct === false) acc.noTranscriptCorrected++;
    return acc;
  }, transcriberObj);

// Split transcript into syllables
export const splitIntoSyllables = (transcript) =>
  transcript.split(/[\\s་།]+/).filter(Boolean);

/* -------------------- REVIEWERS -------------------- */

// Get reviewers of a group
export const reviewerOfGroup = async (groupId) => {
  try {
    return await prisma.user.findMany({ where: { group_id: parseInt(groupId), role: "REVIEWER" } });
  } catch (error) {
    console.error("Error getting reviewers of group:", error);
    throw new Error(error);
  }
};

// Generate reviewer report by group
export const generateReviewerReportbyGroup = async (groupId, dates) => {
  try {
    const reviewers = await reviewerOfGroup(groupId);
    return Promise.all(reviewers.map((reviewer) => generateReviewerTaskReport(reviewer, dates)));
  } catch (error) {
    console.error("Error generating reviewer report:", error);
    throw new Error(error);
  }
};

// Generate reviewer task report
export const generateReviewerTaskReport = async (reviewer, dates) => {
  const { id, name } = reviewer;
  const [reviewerStats, reviewerTasks] = await Promise.all([getReviewerTaskCount(id, dates), getReviewerTaskList(id, dates)]);

  const reviewerObj = {
    id,
    name,
    noReviewed: reviewerStats.noReviewed,
    noAccepted: reviewerStats.noAccepted,
    noFinalised: reviewerStats.noFinalised,
    reviewedInMin: (reviewerStats.reviewedSecs / 60).toFixed(2),
    noReviewedTranscriptCorrected: 0,
    cer: 0,
    totalCer: 0,
    characterCount: 0,
  };

  return moreReviewerStats(reviewerObj, reviewerTasks);
};

// Summarize reviewer tasks
export const moreReviewerStats = (reviewerObj, reviewerTasks) =>
  reviewerTasks.reduce((acc, task) => {
    if (task.reviewed_transcript && task.final_transcript) {
      if (task.reviewer_is_correct === false) acc.noReviewedTranscriptCorrected++;
      acc.characterCount += task.reviewed_transcript?.length || 0;
      acc.totalCer += levenshtein.get(task.reviewed_transcript, task.final_transcript);
    }
    return acc;
  }, reviewerObj);

/* -------------------- FINAL REVIEWERS -------------------- */

export const finalReviewerOfGroup = async (groupId) => {
  try {
    return await prisma.user.findMany({ where: { group_id: parseInt(groupId), role: "FINAL_REVIEWER" } });
  } catch (error) {
    console.error("Error getting final reviewers of group:", error);
    throw new Error(error);
  }
};

export const generateFinalReviewerReportbyGroup = async (groupId, dates) => {
  try {
    const finalReviewers = await finalReviewerOfGroup(groupId);
    return generateFinalReviewerTaskReport(finalReviewers, dates, groupId);
  } catch (error) {
    console.error("Error generating final reviewer report:", error);
    throw new Error(error);
  }
};

export const generateFinalReviewerTaskReport = async (finalReviewers, dates, groupId) => {
  const finalReviewerList = [];
  for (const finalReviewer of finalReviewers) {
    const { id, name } = finalReviewer;
    const finalReviewerObj = { id, name, noFinalised: 0, finalisedInMin: 0 };
    const updatedObj = await getFinalReviewerTaskCount(id, dates, finalReviewerObj, groupId);
    finalReviewerList.push(updatedObj);
  }
  return finalReviewerList;
};
