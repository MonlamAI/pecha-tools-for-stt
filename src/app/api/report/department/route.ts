import { NextRequest, NextResponse } from "next/server";
import prisma from "@/service/db";
import levenshtein from "fast-levenshtein";

function tibetanSyllableCount(text?: string | null) {
  if (!text) return 0;
  const tibetanOnly = text.replace(/[^\u0F00-\u0FFF]+/g, "");
  return tibetanOnly.split(/[་།]/).filter(Boolean).length;
}

function inRange(dt?: Date | null, from?: Date, to?: Date) {
  if (!from || !to) return true;
  if (!dt) return false;
  return dt >= from && dt <= to;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentIdRaw = searchParams.get("departmentId");
    const fromRaw = searchParams.get("from") || "";
    const toRaw = searchParams.get("to") || "";

    const departmentId = departmentIdRaw ? Number(departmentIdRaw) : NaN;
    if (!departmentId || Number.isNaN(departmentId)) {
      return NextResponse.json({ error: "Missing or invalid departmentId" }, { status: 400 });
    }

    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;

    // Find groups in department
    const groups = await prisma.group.findMany({
      where: { department_id: departmentId },
      select: { id: true, name: true },
    });
    const groupIds = groups.map((g) => g.id);

    if (groupIds.length === 0) {
      return NextResponse.json({ users: {}, reviewers: {}, finalReviewers: {} }, { status: 200 });
    }

    // Users for these groups
    const users = await prisma.user.findMany({
      where: { group_id: { in: groupIds } },
      select: { id: true, name: true, role: true, group_id: true },
    });

    // Tasks for these groups (optionally bounded by date windows)
    const tasks = await prisma.task.findMany({
      where: {
        group_id: { in: groupIds },
        ...(from && to
          ? {
              OR: [
                { submitted_at: { gte: from, lte: to } },
                { reviewed_at: { gte: from, lte: to } },
                { finalised_reviewed_at: { gte: from, lte: to } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        group_id: true,
        state: true,
        audio_duration: true,
        transcriber_id: true,
        reviewer_id: true,
        final_reviewer_id: true,
        transcript: true,
        reviewed_transcript: true,
        inference_transcript: true,
        final_transcript: true,
        transcriber_is_correct: true,
        reviewer_is_correct: true,
        submitted_at: true,
        reviewed_at: true,
        finalised_reviewed_at: true,
      },
    });

    const usersByGroup: Record<number, { id: number; name: string }[]> = {};
    const reviewersByGroup: Record<number, { id: number; name: string }[]> = {};
    const finalReviewersByGroup: Record<number, { id: number; name: string }[]> = {};
    for (const u of users) {
      if (u.role === "TRANSCRIBER") {
        (usersByGroup[u.group_id] ||= []).push({ id: u.id, name: u.name });
      } else if (u.role === "REVIEWER") {
        (reviewersByGroup[u.group_id] ||= []).push({ id: u.id, name: u.name });
      } else if (u.role === "FINAL_REVIEWER") {
        (finalReviewersByGroup[u.group_id] ||= []).push({ id: u.id, name: u.name });
      }
    }

    const tasksByGroup = new Map<number, typeof tasks>();
    for (const gid of groupIds) tasksByGroup.set(gid, []);
    for (const t of tasks) {
      tasksByGroup.get(t.group_id)!.push(t);
    }

    const usersOut: Record<number, any[]> = {};
    const reviewersOut: Record<number, any[]> = {};
    const finalReviewersOut: Record<number, any[]> = {};

    for (const gid of groupIds) {
      const groupTasks = tasksByGroup.get(gid)!;

      usersOut[gid] = (usersByGroup[gid] || []).map((u) => {
        const byTranscriber = groupTasks.filter((t) => t.transcriber_id === u.id);

        const submittedWindow = byTranscriber.filter(
          (t) =>
            (t.state === "submitted" || t.state === "accepted" || t.state === "finalised") &&
            inRange(t.submitted_at ?? undefined, from, to)
        );
        const reviewedWindow = byTranscriber.filter(
          (t) => (t.state === "accepted" || t.state === "finalised") && inRange(t.reviewed_at ?? undefined, from, to)
        );
        const trashedWindow = byTranscriber.filter(
          (t) => t.state === "trashed" && inRange(t.submitted_at ?? undefined, from, to)
        );

        const noSubmitted = submittedWindow.length;
        const submittedSecs = submittedWindow.reduce((s, t) => s + (t.audio_duration || 0), 0);
        const reviewedSecs = reviewedWindow.reduce((s, t) => s + (t.audio_duration || 0), 0);
        const trashedSecs = trashedWindow.reduce((s, t) => s + (t.audio_duration || 0), 0);

        const noReviewedBasedOnSubmitted = byTranscriber.filter(
          (t) => (t.state === "accepted" || t.state === "finalised") && inRange(t.submitted_at ?? undefined, from, to)
        ).length;

        const transcriberSyllableCount = submittedWindow.reduce(
          (s, t) => s + tibetanSyllableCount(t.transcript ?? undefined),
          0
        );
        const transcriberCer = submittedWindow.reduce((s, t) => {
          if (t.inference_transcript && t.transcript) {
            return s + levenshtein.get(t.inference_transcript, t.transcript);
          }
          return s;
        }, 0);

        let noReviewed = 0;
        let syllableCount = 0;
        let characterCount = 0;
        let totalCer = 0;
        let noTranscriptCorrected = 0;
        for (const t of reviewedWindow) {
          if (t.state === "accepted" || t.state === "finalised") {
            noReviewed++;
            syllableCount += tibetanSyllableCount(t.reviewed_transcript ?? undefined);
            characterCount += t.transcript ? t.transcript.length : 0;
            if (t.transcript && t.reviewed_transcript) {
              totalCer += levenshtein.get(t.transcript, t.reviewed_transcript);
            }
          }
          if (t.transcriber_is_correct === false) noTranscriptCorrected++;
        }

        return {
          id: u.id,
          name: u.name,
          noSubmitted,
          noReviewedBasedOnSubmitted,
          noReviewed,
          submittedInMin: Number((submittedSecs / 60).toFixed(2)),
          reviewedInMin: Number((reviewedSecs / 60).toFixed(2)),
          trashedInMin: Number((trashedSecs / 60).toFixed(2)),
          syllableCount,
          transcriberSyllableCount,
          transcriberCer,
          noTranscriptCorrected,
          characterCount,
          cer: 0,
          totalCer,
        };
      });

      reviewersOut[gid] = (reviewersByGroup[gid] || []).map((u) => {
        const byReviewer = groupTasks.filter((t) => t.reviewer_id === u.id);
        const reviewedWindow = byReviewer.filter(
          (t) => inRange(t.reviewed_at ?? undefined, from, to) && (t.state === "accepted" || t.state === "finalised")
        );
        const noReviewed = reviewedWindow.length;
        const noAccepted = reviewedWindow.filter((t) => t.state === "accepted").length;
        const noFinalised = reviewedWindow.filter((t) => t.state === "finalised").length;
        const reviewedSecs = reviewedWindow.reduce((s, t) => s + (t.audio_duration || 0), 0);

        let noReviewedTranscriptCorrected = 0;
        let characterCount = 0;
        let totalCer = 0;
        for (const t of reviewedWindow) {
          if (t.reviewed_transcript && t.final_transcript) {
            if (t.reviewer_is_correct === false) noReviewedTranscriptCorrected++;
            characterCount += t.reviewed_transcript.length;
            totalCer += levenshtein.get(t.reviewed_transcript, t.final_transcript);
          }
        }

        return {
          id: u.id,
          name: u.name,
          noReviewed,
          noAccepted,
          noFinalised,
          reviewedInMin: Number((reviewedSecs / 60).toFixed(2)),
          noReviewedTranscriptCorrected,
          cer: 0,
          totalCer,
          characterCount,
        };
      });

      finalReviewersOut[gid] = (finalReviewersByGroup[gid] || []).map((u) => {
        const byFinal = groupTasks.filter((t) => t.final_reviewer_id === u.id);
        const finalWindow = byFinal.filter(
          (t) => t.state === "finalised" && inRange(t.finalised_reviewed_at ?? undefined, from, to)
        );
        const noFinalised = finalWindow.length;
        const finalisedSecs = finalWindow.reduce((s, t) => s + (t.audio_duration || 0), 0);
        return {
          id: u.id,
          name: u.name,
          noFinalised,
          finalisedInMin: Number((finalisedSecs / 60).toFixed(2)),
        };
      });
    }

    return NextResponse.json(
      { users: usersOut, reviewers: reviewersOut, finalReviewers: finalReviewersOut },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Department report error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
