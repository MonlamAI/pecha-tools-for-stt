import { NextRequest, NextResponse } from "next/server";
import prisma from "@/service/db";
import levenshtein from "fast-levenshtein";

type Role = "TRANSCRIBER" | "REVIEWER" | "FINAL_REVIEWER";
type State = "imported" | "transcribing" | "trashed" | "submitted" | "accepted" | "finalised";

type UserRow = { id: number; name: string; role: Role };
type TaskRow = {
  id: number;
  state: State;
  audio_duration: number | null;
  transcriber_id: number | null;
  reviewer_id: number | null;
  final_reviewer_id: number | null;
  transcript: string | null;
  reviewed_transcript: string | null;
  inference_transcript: string | null;
  final_transcript: string | null;
  transcriber_is_correct: boolean | null;
  reviewer_is_correct: boolean | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  finalised_reviewed_at: Date | null;
};

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
    const groupIdRaw = searchParams.get("groupId");
    const fromRaw = searchParams.get("from") || "";
    const toRaw = searchParams.get("to") || "";

    if (!groupIdRaw) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    const groupId = Number(groupIdRaw);
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;

    // Fetch users of the group once to include users with zero tasks
    const users = (await prisma.user.findMany({
      where: { group_id: groupId },
      select: { id: true, name: true, role: true },
    })) as unknown as UserRow[];

    // Fetch all tasks for this group once
    const tasks = (await prisma.task.findMany({
      where: {
        group_id: groupId,
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
    })) as unknown as TaskRow[];

    const transcribers = users.filter((u: UserRow) => u.role === "TRANSCRIBER");
    const reviewers = users.filter((u: UserRow) => u.role === "REVIEWER");
    const finalReviewers = users.filter((u: UserRow) => u.role === "FINAL_REVIEWER");

    const usersOut = transcribers.map((u: UserRow) => {
      const byTranscriber = tasks.filter((t: TaskRow) => t.transcriber_id === u.id);

      const submittedWindow = byTranscriber.filter(
        (t: TaskRow) =>
          (t.state === "submitted" || t.state === "accepted" || t.state === "finalised") &&
          inRange(t.submitted_at ?? undefined, from, to)
      );
      const reviewedWindow = byTranscriber.filter(
        (t: TaskRow) =>
          (t.state === "accepted" || t.state === "finalised") && inRange(t.reviewed_at ?? undefined, from, to)
      );
      const trashedWindow = byTranscriber.filter(
        (t: TaskRow) => t.state === "trashed" && inRange(t.submitted_at ?? undefined, from, to)
      );

      const noSubmitted = submittedWindow.length;
      const submittedSecs = submittedWindow.reduce((s: number, t: TaskRow) => s + (t.audio_duration || 0), 0);
      const reviewedSecs = reviewedWindow.reduce((s: number, t: TaskRow) => s + (t.audio_duration || 0), 0);
      const trashedSecs = trashedWindow.reduce((s: number, t: TaskRow) => s + (t.audio_duration || 0), 0);

      const noReviewedBasedOnSubmitted = byTranscriber.filter(
        (t: TaskRow) =>
          (t.state === "accepted" || t.state === "finalised") && inRange(t.submitted_at ?? undefined, from, to)
      ).length;

      const transcriberSyllableCount = submittedWindow.reduce(
        (s: number, t: TaskRow) => s + tibetanSyllableCount(t.transcript ?? undefined),
        0
      );
      const transcriberCer = submittedWindow.reduce((s: number, t: TaskRow) => {
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

    const reviewersOut = reviewers.map((u: UserRow) => {
      const byReviewer = tasks.filter((t: TaskRow) => t.reviewer_id === u.id);
      const reviewedWindow = byReviewer.filter(
        (t: TaskRow) =>
          inRange(t.reviewed_at ?? undefined, from, to) && (t.state === "accepted" || t.state === "finalised")
      );
      const noReviewed = reviewedWindow.length;
      const noAccepted = reviewedWindow.filter((t) => t.state === "accepted").length;
      const noFinalised = reviewedWindow.filter((t) => t.state === "finalised").length;
      const reviewedSecs = reviewedWindow.reduce((s: number, t: TaskRow) => s + (t.audio_duration || 0), 0);

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

    const finalReviewersOut = finalReviewers.map((u: UserRow) => {
      const byFinal = tasks.filter((t: TaskRow) => t.final_reviewer_id === u.id);
      const finalWindow = byFinal.filter(
        (t: TaskRow) => t.state === "finalised" && inRange(t.finalised_reviewed_at ?? undefined, from, to)
      );
      const noFinalised = finalWindow.length;
      const finalisedSecs = finalWindow.reduce((s: number, t: TaskRow) => s + (t.audio_duration || 0), 0);

      return {
        id: u.id,
        name: u.name,
        noFinalised,
        finalisedInMin: Number((finalisedSecs / 60).toFixed(2)),
      };
    });

    return NextResponse.json(
      { users: usersOut, reviewers: reviewersOut, finalReviewers: finalReviewersOut },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
