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

function inRange(dt: Date | null, from?: Date, to?: Date) {
  if (!dt) return false;
  if (from && dt < from) return false;
  if (to && dt > to) return false;
  return true;
}

/* ---------------- API ---------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const departmentId = Number(searchParams.get("departmentId"));
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;

    if (!departmentId) {
      return NextResponse.json(
        { error: "Invalid departmentId" },
        { status: 400 }
      );
    }

    /* -------- groups -------- */

    const groups = await prisma.group.findMany({
      where: { department_id: departmentId },
      select: { id: true },
    });

    const groupIds = groups.map(g => g.id);
    if (!groupIds.length) {
      return NextResponse.json(
        { users: {}, reviewers: {}, finalReviewers: {} },
        { status: 200 }
      );
    }

    /* -------- users + tasks -------- */

    const [users, tasks] = await Promise.all([
      prisma.user.findMany({
        where: { group_id: { in: groupIds } },
        select: { id: true, name: true, role: true, group_id: true },
      }),
      prisma.task.findMany({
        where: {
          group_id: { in: groupIds },
          OR: [
            { submitted_at: { gte: from, lte: to } },
            { reviewed_at: { gte: from, lte: to } },
            { finalised_reviewed_at: { gte: from, lte: to } },
          ],
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
      }),
    ]);

    /* -------- TASK MAPS (  critical) -------- */

    const transcriberMap = new Map<number, any[]>();
    const reviewerMap = new Map<number, any[]>();
    const finalReviewerMap = new Map<number, any[]>();

    for (const t of tasks) {
      if (t.transcriber_id) {
        let arr = transcriberMap.get(t.transcriber_id);
        if (!arr) {
          arr = [];
          transcriberMap.set(t.transcriber_id, arr);
        }
        arr.push(t);
      }

      if (t.reviewer_id) {
        let arr = reviewerMap.get(t.reviewer_id);
        if (!arr) {
          arr = [];
          reviewerMap.set(t.reviewer_id, arr);
        }
        arr.push(t);
      }

      if (t.final_reviewer_id) {
        let arr = finalReviewerMap.get(t.final_reviewer_id);
        if (!arr) {
          arr = [];
          finalReviewerMap.set(t.final_reviewer_id, arr);
        }
        arr.push(t);
      }
    }


    /* -------- users by group -------- */

    const usersOut: Record<number, any[]> = {};
    const reviewersOut: Record<number, any[]> = {};
    const finalReviewersOut: Record<number, any[]> = {};

    for (const gid of groupIds) {
      usersOut[gid] = [];
      reviewersOut[gid] = [];
      finalReviewersOut[gid] = [];
    }

    /* =====================================================
       MAIN LOOP (NO FILTERS, PURE MAP LOOKUPS)
    ===================================================== */

    /* =====================================================
       MAIN LOOP (MATCHING GROUP LOGIC: NO STRICT sub-checks)
    ===================================================== */

    for (const u of users) {
      /* ---------------- TRANSCRIBER ---------------- */
      if (u.role === "TRANSCRIBER") {
        const userTasks = transcriberMap.get(u.id) ?? [];
        /* If user has no tasks in map, fallback to 0 using defaultTranscriberStats logic later if needed 
           BUT here we push directly. We must handle 0s or empty. 
           Actually, the "usersOut" structure here is different from group route which returns list of users.
           Here we push to usersOut[gid]. 
        */

        let submittedSecs = 0;
        let reviewedSecs = 0;
        let trashedSecs = 0;
        let noSubmitted = 0;
        let noReviewedBasedOnSubmitted = 0;
        let noReviewed = 0;
        let syllableCount = 0;
        let transcriberSyllableCount = 0;
        let transcriberCer = 0;
        let totalCer = 0;
        let noTranscriptCorrected = 0;
        let characterCount = 0;

        for (const t of userTasks) {
          /* Enforce Group Boundry: Match group/route.ts behavior */
          if (t.group_id !== u.group_id) continue;

          /* submitted window */
          if (["submitted", "accepted", "finalised", "trashed"].includes(t.state)) {
            noSubmitted++;
            submittedSecs += t.audio_duration || 0;
            transcriberSyllableCount += tibetanSyllableCount(t.transcript);
          }

          /* reviewed based on submitted */
          if (["accepted", "finalised"].includes(t.state)) {
            noReviewedBasedOnSubmitted++;
          }

          /* reviewed */
          if (["accepted", "finalised"].includes(t.state)) {
            noReviewed++;
            reviewedSecs += t.audio_duration || 0;
            syllableCount += tibetanSyllableCount(t.reviewed_transcript);
            characterCount += t.reviewed_transcript?.length || 0;

            if (t.transcript && t.reviewed_transcript) {
              totalCer += levenshtein.get(
                t.transcript,
                t.reviewed_transcript
              );
            }

            if (t.transcriber_is_correct === false)
              noTranscriptCorrected++;
          }

          /* CER (submitted) */
          if (t.inference_transcript && t.transcript) {
            transcriberCer += levenshtein.get(
              t.inference_transcript,
              t.transcript
            );
          }

          /* trashed */
          if (t.state === "trashed") {
            trashedSecs += t.audio_duration || 0;
          }
        }

        usersOut[u.group_id].push({
          id: u.id,
          name: u.name,
          noSubmitted,
          noReviewedBasedOnSubmitted,
          noReviewed,
          submittedInMin: +(submittedSecs / 60).toFixed(2),
          reviewedInMin: +(reviewedSecs / 60).toFixed(2),
          trashedInMin: +(trashedSecs / 60).toFixed(2),
          syllableCount,
          transcriberSyllableCount,
          transcriberCer,
          noTranscriptCorrected,
          characterCount,
          totalCer,
        });
      }

      /* ---------------- REVIEWER ---------------- */
      if (u.role === "REVIEWER") {
        const userTasks = reviewerMap.get(u.id) ?? [];

        let reviewedSecs = 0;
        let noReviewed = 0;
        let noAccepted = 0;
        let noFinalised = 0;
        let noReviewedTranscriptCorrected = 0;
        let characterCount = 0;
        let totalCer = 0;

        for (const t of userTasks) {
          if (t.group_id !== u.group_id) continue;

          if (["accepted", "finalised"].includes(t.state)) {
            noReviewed++;
            reviewedSecs += t.audio_duration || 0;

            if (t.state === "accepted") noAccepted++;
            if (t.state === "finalised") noFinalised++;

            if (t.reviewed_transcript && t.final_transcript) {
              characterCount += t.reviewed_transcript.length;
              totalCer += levenshtein.get(
                t.reviewed_transcript,
                t.final_transcript
              );

              if (t.reviewer_is_correct === false)
                noReviewedTranscriptCorrected++;
            }
          }
        }

        reviewersOut[u.group_id].push({
          id: u.id,
          name: u.name,
          noReviewed,
          noAccepted,
          noFinalised,
          reviewedInMin: +(reviewedSecs / 60).toFixed(2),
          noReviewedTranscriptCorrected,
          totalCer,
          characterCount,
        });
      }

      /* ---------------- FINAL REVIEWER ---------------- */
      if (u.role === "FINAL_REVIEWER") {
        const userTasks = finalReviewerMap.get(u.id) ?? [];

        let noFinalised = 0;
        let finalisedSecs = 0;

        for (const t of userTasks) {
          if (t.group_id !== u.group_id) continue;

          if (t.state === "finalised") {
            noFinalised++;
            finalisedSecs += t.audio_duration || 0;
          }
        }

        finalReviewersOut[u.group_id].push({
          id: u.id,
          name: u.name,
          noFinalised,
          finalisedInMin: +(finalisedSecs / 60).toFixed(2),
        });
      }
    }

    return NextResponse.json(
      { users: usersOut, reviewers: reviewersOut, finalReviewers: finalReviewersOut },
      { status: 200 }
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
