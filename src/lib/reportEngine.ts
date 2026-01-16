import levenshtein from "fast-levenshtein";

/* ---------- types ---------- */

interface Task {
  id: number;
  state: string;
  audio_duration?: number;
  transcriber_id?: number | null;
  reviewer_id?: number | null;
  final_reviewer_id?: number | null;
  transcript?: string | null;
  reviewed_transcript?: string | null;
  inference_transcript?: string | null;
  final_transcript?: string | null;
  transcriber_is_correct?: boolean | null;
  reviewer_is_correct?: boolean | null;
  submitted_at?: Date | null;
  reviewed_at?: Date | null;
  finalised_reviewed_at?: Date | null;
}

/* ---------- helpers ---------- */

/**
 * DB stores IST as UTC literal (e.g. 12:00 PM IST is 12:00 PM UTC).
 * We parse the date as a literal UTC start/end of day.
 */
export function parseLiteralUTC(ds?: string | null | Date, endOfDay = false) {
  if (!ds) return undefined;
  if (ds instanceof Date) return ds;

  const dateStr = ds.split("T")[0];
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return new Date(dateStr + suffix);
}

export function tibetanSyllableCount(text?: string | null) {
  if (!text) return 0;
  const tibetanOnly = text.replace(/[^\u0F00-\u0FFF]+/g, "");
  return tibetanOnly.split(/[་།]/).filter(Boolean).length;
}

function inRange(dt: any, from?: Date, to?: Date) {
  if (!dt) return false;
  // Convert to date if it's a string fromprisma
  const d = dt instanceof Date ? dt : new Date(dt);
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

/* ---------- main engine ---------- */

export function buildReport({
  users,
  tasks,
  from,
  to,
}: {
  users: any[];
  tasks: Task[];
  from?: Date;
  to?: Date;
}) {
  /* ---------- CACHES (Request Level) ---------- */
  const syllableCache = new Map<string, number>();
  const getSyllables = (txt?: string | null): number => {
    if (!txt) return 0;
    const cached = syllableCache.get(txt);
    if (cached !== undefined) return cached;

    const val = tibetanSyllableCount(txt);
    syllableCache.set(txt, val);
    return val;
  };

  const cerCache = new Map<string, number>();
  const getCer = (a?: string | null, b?: string | null): number => {
    if (!a || !b) return 0;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const cached = cerCache.get(key);
    if (cached !== undefined) return cached;

    const val = levenshtein.get(a, b);
    cerCache.set(key, val);
    return val;
  };

  /* ---------- TASK MAPS ---------- */
  const transcriberMap = new Map<number, Task[]>();
  const reviewerMap = new Map<number, Task[]>();
  const finalReviewerMap = new Map<number, Task[]>();

  for (const t of tasks) {
    if (t.transcriber_id !== null && t.transcriber_id !== undefined) {
      let bucket = transcriberMap.get(t.transcriber_id);
      if (!bucket) {
        bucket = [];
        transcriberMap.set(t.transcriber_id, bucket);
      }
      bucket.push(t);
    }

    if (t.reviewer_id !== null && t.reviewer_id !== undefined) {
      let bucket = reviewerMap.get(t.reviewer_id);
      if (!bucket) {
        bucket = [];
        reviewerMap.set(t.reviewer_id, bucket);
      }
      bucket.push(t);
    }

    if (t.final_reviewer_id !== null && t.final_reviewer_id !== undefined) {
      let bucket = finalReviewerMap.get(t.final_reviewer_id);
      if (!bucket) {
        bucket = [];
        finalReviewerMap.set(t.final_reviewer_id, bucket);
      }
      bucket.push(t);
    }
  }

  /* ---------- OUTPUT ---------- */
  const usersOut: any[] = [];
  const reviewersOut: any[] = [];
  const finalReviewersOut: any[] = [];

  /* ---------- USERS ---------- */
  for (const u of users) {
    /* ===== TRANSCRIBER ===== */
    if (u.role === "TRANSCRIBER") {
      const userTasks = transcriberMap.get(u.id) ?? [];

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
        /* submitted window */
        if (
          ["submitted", "accepted", "finalised"].includes(t.state) &&
          inRange(t.submitted_at, from, to)
        ) {
          noSubmitted++;
          submittedSecs += t.audio_duration || 0;
          transcriberSyllableCount += getSyllables(t.transcript);

          if (t.inference_transcript && t.transcript) {
            transcriberCer += getCer(t.inference_transcript, t.transcript);
          }
        }

        /* reviewed */
        if (
          ["accepted", "finalised"].includes(t.state) &&
          inRange(t.reviewed_at, from, to) &&
          inRange(t.submitted_at, from, to)
        ) {
          noReviewed++;
          reviewedSecs += t.audio_duration || 0;
          syllableCount += getSyllables(t.reviewed_transcript);
          characterCount += t.reviewed_transcript?.length || 0;

          if (t.transcript && t.reviewed_transcript) {
            totalCer += getCer(t.transcript, t.reviewed_transcript);
          }

          if (t.transcriber_is_correct === false)
            noTranscriptCorrected++;
        }

        /* reviewed based on submitted */
        if (
          ["accepted", "finalised"].includes(t.state) &&
          inRange(t.submitted_at, from, to)
        ) {
          noReviewedBasedOnSubmitted++;
        }

        /* trashed */
        if (
          t.state === "trashed" &&
          inRange(t.submitted_at, from, to)
        ) {
          trashedSecs += t.audio_duration || 0;
        }
      }

      usersOut.push({
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

    /* ===== REVIEWER ===== */
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
        if (
          ["accepted", "finalised"].includes(t.state) &&
          inRange(t.reviewed_at, from, to)
        ) {
          noReviewed++;
          reviewedSecs += t.audio_duration || 0;

          if (t.state === "accepted") noAccepted++;
          if (t.state === "finalised") noFinalised++;

          if (t.reviewed_transcript && t.final_transcript) {
            characterCount += t.reviewed_transcript?.length || 0;
            totalCer += getCer(t.reviewed_transcript, t.final_transcript);

            if (t.reviewer_is_correct === false)
              noReviewedTranscriptCorrected++;
          }
        }
      }

      reviewersOut.push({
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

    /* ===== FINAL REVIEWER ===== */
    if (u.role === "FINAL_REVIEWER") {
      const userTasks = finalReviewerMap.get(u.id) ?? [];

      let noFinalised = 0;
      let finalisedSecs = 0;

      for (const t of userTasks) {
        if (
          t.state === "finalised" &&
          inRange(t.finalised_reviewed_at, from, to)
        ) {
          noFinalised++;
          finalisedSecs += t.audio_duration || 0;
        }
      }

      finalReviewersOut.push({
        id: u.id,
        name: u.name,
        noFinalised,
        finalisedInMin: +(finalisedSecs / 60).toFixed(2),
      });
    }
  }

  return {
    users: usersOut,
    reviewers: reviewersOut,
    finalReviewers: finalReviewersOut,
  };
}
