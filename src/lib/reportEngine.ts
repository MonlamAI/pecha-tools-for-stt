import levenshtein from "fast-levenshtein";

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

function inRange(dt: Date | null, from?: Date, to?: Date) {
  if (!dt) return false;
  const t = dt.getTime();
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
  tasks: any[];
  from?: Date;
  to?: Date;
}) {
  /* ---------- TASK MAPS ---------- */
  const transcriberMap = new Map<number, any[]>();
  const reviewerMap = new Map<number, any[]>();
  const finalReviewerMap = new Map<number, any[]>();

  for (const t of tasks) {
    if (t.transcriber_id) {
      let bucket = transcriberMap.get(t.transcriber_id);
      if (!bucket) {
        bucket = [];
        transcriberMap.set(t.transcriber_id, bucket);
      }
      bucket.push(t);
    }

    if (t.reviewer_id) {
      let bucket = reviewerMap.get(t.reviewer_id);
      if (!bucket) {
        bucket = [];
        reviewerMap.set(t.reviewer_id, bucket);
      }
      bucket.push(t);
    }

    if (t.final_reviewer_id) {
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
          transcriberSyllableCount += tibetanSyllableCount(t.transcript);

          if (t.inference_transcript && t.transcript) {
            transcriberCer += levenshtein.get(
              t.inference_transcript,
              t.transcript
            );
          }
        }

        /* reviewed */
        if (
          ["accepted", "finalised"].includes(t.state) &&
          inRange(t.reviewed_at, from, to)
        ) {
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