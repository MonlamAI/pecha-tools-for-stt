import { NextRequest, NextResponse } from "next/server";
import prisma from "@/service/db";
import levenshtein from "fast-levenshtein";

export const runtime = "nodejs";

/* ---------------- helpers ---------------- */

function tibetanSyllableCount(text?: string | null) {
  if (!text) return 0;
  const tibetanOnly = text.replace(/[^\u0F00-\u0FFF]+/g, "");
  return tibetanOnly.split(/[་།]/).filter(Boolean).length;
}

/* ---------------- API ---------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const groupId = Number(searchParams.get("groupId"));
    const from = new Date(searchParams.get("from")!);
    const to = new Date(searchParams.get("to")!);

    if (!groupId || !from || !to) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    /* ---------------- DB FETCH (2 QUERIES TOTAL) ---------------- */

    const [users, tasks] = await Promise.all([
      prisma.user.findMany({
        where: { group_id: groupId },
        select: { id: true, name: true, role: true },
      }),

      prisma.task.findMany({
        where: {
          group_id: groupId,
          OR: [
            { submitted_at: { gte: from, lte: to } },
            { reviewed_at: { gte: from, lte: to } },
            { finalised_reviewed_at: { gte: from, lte: to } },
          ],
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
        },
      }),
    ]);

    /* ---------------- ACCUMULATORS ---------------- */

    const T = new Map<number, any>();
    const R = new Map<number, any>();
    const F = new Map<number, any>();

    const ensure = (map: Map<number, any>, id: number, init: any) => {
      if (!map.has(id)) map.set(id, { ...init });
      return map.get(id);
    };

    /* ---------------- SINGLE PASS OVER TASKS ---------------- */

    for (const t of tasks) {
      /* ---------- TRANSCRIBER ---------- */
      if (t.transcriber_id) {
        const o = ensure(T, t.transcriber_id, {
          noSubmitted: 0,
          noReviewedBasedOnSubmitted: 0,
          noReviewed: 0,
          submittedSecs: 0,
          reviewedSecs: 0,
          trashedSecs: 0,
          syllableCount: 0,
          transcriberSyllableCount: 0,
          transcriberCer: 0,
          totalCer: 0,
          noTranscriptCorrected: 0,
          characterCount: 0,
        });

        if (["submitted", "accepted", "finalised", "trashed"].includes(t.state)) {
          o.noSubmitted++;
          o.submittedSecs += t.audio_duration || 0;
          o.transcriberSyllableCount += tibetanSyllableCount(t.transcript);
        }

        if (["accepted", "finalised"].includes(t.state)) {
          o.noReviewed++;
          o.noReviewedBasedOnSubmitted++;
          o.reviewedSecs += t.audio_duration || 0;
          o.syllableCount += tibetanSyllableCount(t.reviewed_transcript);
          o.characterCount += t.reviewed_transcript?.length || 0;

          if (t.transcript && t.reviewed_transcript) {
            o.totalCer += levenshtein.get(t.transcript, t.reviewed_transcript);
          }
          if (t.inference_transcript && t.transcript) {
            o.transcriberCer += levenshtein.get(t.inference_transcript, t.transcript);
          }
          if (t.transcriber_is_correct === false) {
            o.noTranscriptCorrected++;
          }
        }

        if (t.state === "trashed") {
          o.trashedSecs += t.audio_duration || 0;
        }
      }

      /* ---------- REVIEWER ---------- */
      if (t.reviewer_id && ["accepted", "finalised"].includes(t.state)) {
        const o = ensure(R, t.reviewer_id, {
          noReviewed: 0,
          noAccepted: 0,
          noFinalised: 0,
          reviewedSecs: 0,
          noReviewedTranscriptCorrected: 0,
          characterCount: 0,
          totalCer: 0,
        });

        o.noReviewed++;
        o.reviewedSecs += t.audio_duration || 0;
        if (t.state === "accepted") o.noAccepted++;
        if (t.state === "finalised") o.noFinalised++;

        o.characterCount += t.reviewed_transcript?.length || 0;

        if (t.reviewed_transcript && t.final_transcript) {
          o.totalCer += levenshtein.get(
            t.reviewed_transcript,
            t.final_transcript
          );
        }

        if (t.reviewer_is_correct === false) {
          o.noReviewedTranscriptCorrected++;
        }
      }

      /* ---------- FINAL REVIEWER ---------- */
      if (t.final_reviewer_id && t.state === "finalised") {
        const o = ensure(F, t.final_reviewer_id, {
          noFinalised: 0,
          finalisedSecs: 0,
        });
        o.noFinalised++;
        o.finalisedSecs += t.audio_duration || 0;
      }
    }

    /* ---------------- OUTPUT ---------------- */

    const defaultTranscriberStats = {
      noSubmitted: 0,
      noReviewedBasedOnSubmitted: 0,
      noReviewed: 0,
      submittedSecs: 0,
      reviewedSecs: 0,
      trashedSecs: 0,
      syllableCount: 0,
      transcriberSyllableCount: 0,
      transcriberCer: 0,
      totalCer: 0,
      noTranscriptCorrected: 0,
      characterCount: 0,
    };

    const defaultReviewerStats = {
      noReviewed: 0,
      noAccepted: 0,
      noFinalised: 0,
      reviewedSecs: 0,
      noReviewedTranscriptCorrected: 0,
      characterCount: 0,
      totalCer: 0, // Added based on usage in loop but might not be in output object directly, check usage
    };

    const defaultFinalReviewerStats = {
      noFinalised: 0,
      finalisedSecs: 0,
    };

    const usersOut = [];
    const reviewersOut = [];
    const finalReviewersOut = [];

    for (const u of users) {
      if (u.role === "TRANSCRIBER") {
        const o = T.get(u.id) || defaultTranscriberStats;
        usersOut.push({
          id: u.id,
          name: u.name,
          ...o,
          submittedInMin: +(o.submittedSecs / 60 || 0).toFixed(2),
          reviewedInMin: +(o.reviewedSecs / 60 || 0).toFixed(2),
          trashedInMin: +(o.trashedSecs / 60 || 0).toFixed(2),
        });
      }

      if (u.role === "REVIEWER") {
        const o = R.get(u.id) || defaultReviewerStats;
        reviewersOut.push({
          id: u.id,
          name: u.name,
          ...o,
          reviewedInMin: +(o.reviewedSecs / 60 || 0).toFixed(2),
        });
      }

      if (u.role === "FINAL_REVIEWER") {
        const o = F.get(u.id) || defaultFinalReviewerStats;
        finalReviewersOut.push({
          id: u.id,
          name: u.name,
          noFinalised: o.noFinalised || 0,
          finalisedInMin: +((o.finalisedSecs || 0) / 60).toFixed(2),
        });
      }
    }

    return NextResponse.json(
      { users: usersOut, reviewers: reviewersOut, finalReviewers: finalReviewersOut },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
