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
      orderBy: {
        id: "asc",
      },
    });
    return users;
  } catch (error) {
    console.error("Error getting all the user:", error);
    throw new Error(error);
  }
};

export const createUser = async (_prevState, formData) => {
  const name = formData.get("name")?.trim();
  const email = formData.get("email")?.trim();
  const groupId = formData.get("group_id");
  console.log("crateUser:", { groupId });
  const role = formData.get("role");
  try {
    // check if username  and email already exists
    const userByName = await prisma.user.findFirst({
      where: {
        name: name,
      },
    });

    const userByEmail = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (userByName && userByEmail) {
      return {
        error: "User already exists with the same username and email",
      };
    } else if (userByName) {
      return {
        error: "User already exists with the same username",
      };
    } else if (userByEmail) {
      return {
        error: "User already exists with the same email",
      };
    }
    // If no matching user was found, you can proceed with user creating new user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        group_id: parseInt(groupId),
        role,
      },
    });
    revalidatePath("/dashboard/user");
    // if new user is created, send msg to client side that user is created
    if (newUser) {
      return {
        success: "User created successfully",
      };
    } else {
      return {
        error: "Error creating user",
      };
    }
  } catch (error) {
    console.error("Error adding a user", error);
    if (error?.code === "P2002") {
      return { error: "Duplicate username or email" };
    }
    return { error: "Failed to create user. Please try again." };
  }
};

export const deleteUser = async (id) => {
  try {
    // Prevent delete if user is referenced in tasks
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

    await prisma.user.delete({
      where: { id },
    });
    revalidatePath("/dashboard/user");
    return { success: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting a user", error);
    return { error: "Failed to delete user. Please try again." };
  }
};

// useFormState wrapper: delete user from FormData (expects name="id")
export const deleteUserByForm = async (_prevState, formData) => {
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" ? parseInt(idRaw) : Number(idRaw);
  if (!id || Number.isNaN(id)) {
    return { error: "Invalid user id" };
  }
  return await deleteUser(id);
};

export const editUser = async (id, formData) => {
  const name = formData.get("name")?.trim();
  const email = formData.get("email")?.trim();
  const groupId = formData.get("group_id");
  const role = formData.get("role");

  try {
    // check if username  and email already exists
    const userId = parseInt(id); // Ensure id is converted to an integer
    const userByName = await prisma.user.findFirst({
      where: {
        name: name,
        NOT: {
          id: userId,
        },
      },
    });

    const userByEmail = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: {
          id: userId,
        },
      },
    });

    if (userByName && userByEmail) {
      return {
        error: "User already exists with the same username and email",
      };
    } else if (userByName) {
      return {
        error: "User already exists with the same username",
      };
    } else if (userByEmail) {
      return {
        error: "User already exists with the same email",
      };
    }
    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: {
        name,
        email,
        group_id: parseInt(groupId),
        role,
      },
    });
    revalidatePath("/dashboard/user");
    // if user data is edited , send msg to client side that user is created
    if (updatedUser) {
      return {
        success: "User edited successfully",
      };
    } else {
      return {
        error: "Error editing user",
      };
    }
  } catch (error) {
    console.error("Error updating a user details", error);
    if (error?.code === "P2002") {
      return { error: "Duplicate username or email" };
    }
    return { error: "Failed to update user. Please try again." };
  }
};

// useFormState wrapper: edit user from FormData (expects name="id")
export const editUserByForm = async (_prevState, formData) => {
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" ? parseInt(idRaw) : Number(idRaw);
  if (!id || Number.isNaN(id)) {
    return { error: "Invalid user id" };
  }
  return await editUser(id, formData);
};

export const getUsersByGroup = async (groupId) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        group_id: parseInt(groupId),
        role: "TRANSCRIBER",
      },
    });
    return users;
  } catch (error) {
    console.error("Error getting users by group:", error);
    throw new Error(error);
  }
};

export const generateUserReportByGroup = async (groupId, dates) => {
  try {
    const users = await getUsersByGroup(groupId);

    // if user is not found, return empty array
    if (!users) {
      return [];
    }
    const usersStatistic = await Promise.all(
      users.map((user) => generateUsersTaskReport(user, dates, groupId))
    );
    return usersStatistic;
  } catch (error) {
    console.error("Error generating transcriber report by group:", error);
    throw new Error("Failed to generate transcriber report.");
  }
};

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

  const updatedTranscriberObj = await UserTaskReport(transcriberObj, userTasks);

  return updatedTranscriberObj;
};

const getTranscriberCer = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const transcriberId = parseInt(id); // Ensure id is an integer
  const dateFilter = buildDateFilter(fromDate, toDate);
  try {
    const tasks = await prisma.task.findMany({
      where: {
        transcriber_id: transcriberId,
        ...dateFilter,
      },
      select: {
        inference_transcript: true,
        transcript: true,
      },
    });
    const transcriberCer = tasks.reduce((acc, task) => {
      if (task.transcript && task.inference_transcript) {
        const cer = levenshtein.get(task.inference_transcript, task.transcript);
        acc += cer;
      }
      return acc;
    }, 0);
    return transcriberCer;
  } catch (error) {
    console.log("Error getting transcriber cer:", error);
  }
};

function tibetanSyllableCount(text) {
  // keep only Tibetan range chars plus spaces/punct you care about
  const tibetanOnly = text.replace(/[^\u0F00-\u0FFF]+/g, "");

  return tibetanOnly
    .split(/[་།]/) // split on tsek and shad
    .filter(Boolean); // drop empties
}

const getTranscriberSyllableCount = async (id, dates) => {
  const { from: fromDate, to: toDate } = dates;
  const transcriberId = parseInt(id); // Ensure id is an integer
  const dateFilter = buildDateFilter(fromDate, toDate);

  try {
    const transcriberTasks = await prisma.task.findMany({
      where: {
        transcriber_id: transcriberId,
        state: { in: ["submitted", "accepted", "finalised"] },
        ...dateFilter,
      },
    });

    return transcriberTasks.reduce((count, task) => {
      return (count += tibetanSyllableCount(task.transcript).length);
    }, 0);
  } catch (error) {
    console.log("Error getting transcriber syllable count:", error);
  }
};

const buildDateFilter = (fromDate, toDate) => {
  if (fromDate && toDate) {
    return {
      submitted_at: {
        gte: utcToIst(new Date(fromDate)),
        lte: utcToIst(new Date(toDate)),
      },
    };
  }
  return {};
};

export const getReviewedCountBasedOnSubmittedAt = async (
  id,
  dates,
  groupId
) => {
  const { from: fromDate, to: toDate } = dates;

  const transcriberId = parseInt(id); // Ensure id is an integer
  const group_id = parseInt(groupId); // Ensure groupId is an integer

  const dateFilter = buildDateFilter(fromDate, toDate);

  try {
    const reviewedTaskCount = await prisma.task.count({
      where: {
        transcriber_id: transcriberId,
        state: { in: ["accepted", "finalised"] },
        ...dateFilter,
      },
    });

    return reviewedTaskCount;
  } catch (error) {
    console.error("Error getting reviewed and finalised task count:", error);
    throw new Error("Error fetching task counts.");
  }
};

// get the task statistics - task reviewed, reviewed secs, syllable count
export const UserTaskReport = (transcriberObj, userTasks) => {
  const userTaskSummary = userTasks.reduce((acc, task) => {
    if (["accepted", "finalised"].includes(task.state)) {
      acc.noReviewed++;

      acc.syllableCount += tibetanSyllableCount(
        task.reviewed_transcript
      ).length;

      acc.characterCount += task.transcript ? task.transcript.length : 0;
      // Ensure both transcripts are available before calculating CER
      if (task.transcript && task.reviewed_transcript) {
        const cer = levenshtein.get(task.transcript, task.reviewed_transcript);
        acc.totalCer += cer; // Add CER for each task to total
      }
    }
    if (task.transcriber_is_correct === false) {
      acc.noTranscriptCorrected++;
    }
    return acc;
  }, transcriberObj);
  return userTaskSummary;
};

export const splitIntoSyllables = (transcript) => {
  // Split the text into syllables using regular expressions
  const syllables = transcript.split(/[\\s་།]+/);
  // Filter out empty syllables
  const filteredSplit = syllables.filter((s) => s !== "");
  return filteredSplit;
};

export const reviewerOfGroup = async (groupId) => {
  try {
    const reviewers = await prisma.user.findMany({
      where: {
        group_id: parseInt(groupId),
        role: "REVIEWER",
      },
    });
    return reviewers;
  } catch (error) {
    console.error("Error getting reviewers of group:", error);
    throw new Error(error);
  }
};

// for all the reviewers of a group retun the task statistics - task reviewed, task accepted, task finalised
export const generateReviewerReportbyGroup = async (groupId, dates) => {
  try {
    const reviewers = await reviewerOfGroup(groupId);
    const reviewersReport = await Promise.all(
      reviewers.map((reviewer) => generateReviewerTaskReport(reviewer, dates))
    );

    return reviewersReport;
  } catch (error) {
    console.error("Error getting users by group:", error);
    throw new Error(error);
  }
};

export const generateReviewerTaskReport = async (reviewer, dates) => {
  const { id, name } = reviewer;

  const [reviewerStats, reviewerTasks] = await Promise.all([
    getReviewerTaskCount(id, dates),
    getReviewerTaskList(id, dates),
  ]);

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

  // const updatedReviwerObj = await getReviewerTaskCount(id, dates, reviewerObj);
  const updatedReviewerObj = await moreReviewerStats(
    reviewerObj,
    reviewerTasks
  );

  return updatedReviewerObj;
};

export const moreReviewerStats = (reviewerObj, reviewerTasks) => {
  const reviewerTaskSummary = reviewerTasks.reduce((acc, task) => {
    if (task.reviewed_transcript && task.final_transcript) {
      if (task.reviewer_is_correct === false) {
        acc.noReviewedTranscriptCorrected++;
      }
      acc.characterCount += task.reviewed_transcript
        ? task.reviewed_transcript.length
        : 0;
      const cer = levenshtein.get(
        task.reviewed_transcript,
        task.final_transcript
      );
      acc.totalCer += cer; // Add CER for each task to total
    }
    return acc;
  }, reviewerObj);
  return reviewerTaskSummary;
};

// for all the final reviewers of a group retun the task statistics - task finalised, finalised mintues
export const generateFinalReviewerReportbyGroup = async (groupId, dates) => {
  try {
    const finalReviewers = await finalReviewerOfGroup(groupId);
    const usersReport = generateFinalReviewerTaskReport(
      finalReviewers,
      dates,
      groupId
    );
    return usersReport;
  } catch (error) {
    console.error("Error getting users by group:", error);
    throw new Error(error);
  }
};

export const finalReviewerOfGroup = async (groupId) => {
  try {
    const finalReviewers = await prisma.user.findMany({
      where: {
        group_id: parseInt(groupId),
        role: "FINAL_REVIEWER",
      },
    });
    return finalReviewers;
  } catch (error) {
    console.error("Error getting final reviewers of group:", error);
    throw new Error(error);
  }
};

export const generateFinalReviewerTaskReport = async (
  finalReviewers,
  dates,
  groupId
) => {
  const finalReviewerList = [];

  for (const finalReviewer of finalReviewers) {
    const { id, name } = finalReviewer;

    const finalReviewerObj = {
      id,
      name,
      noFinalised: 0,
      finalisedInMin: 0,
    };

    const updatedFinalReviwerObj = await getFinalReviewerTaskCount(
      id,
      dates,
      finalReviewerObj,
      groupId
    );
    finalReviewerList.push(updatedFinalReviwerObj);
  }
  return finalReviewerList;
};
