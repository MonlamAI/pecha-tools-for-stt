"use client";
import React from "react";

const Stat = ({ label, value }) => (
  <div className="flex flex-col items-center px-3 py-2">
    <div className="text-xs opacity-70">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default function DepartmentGroupTotal({ users = [], reviewers = [], finals = [] }) {
  const sum = (arr, key) => arr.reduce((a, b) => a + (Number(b?.[key]) || 0), 0);

  // Transcribers
  const t_noSubmitted = sum(users, "noSubmitted");
  const t_noReviewedBasedOnSubmitted = sum(users, "noReviewedBasedOnSubmitted");
  const t_noReviewed = sum(users, "noReviewed");
  const t_submittedInMin = sum(users, "submittedInMin");
  const t_reviewedInMin = sum(users, "reviewedInMin");
  const t_trashedInMin = sum(users, "trashedInMin");
  const t_syllableCount = sum(users, "syllableCount");
  const t_transcriberSyllableCount = sum(users, "transcriberSyllableCount");
  const t_transcriberCer = sum(users, "transcriberCer");
  const t_noTranscriptCorrected = sum(users, "noTranscriptCorrected");
  const t_characterCount = sum(users, "characterCount");
  const t_totalCer = sum(users, "totalCer");

  // Reviewers
  const r_noReviewed = sum(reviewers, "noReviewed");
  const r_noAccepted = sum(reviewers, "noAccepted");
  const r_noFinalised = sum(reviewers, "noFinalised");
  const r_reviewedInMin = sum(reviewers, "reviewedInMin");
  const r_noReviewedTranscriptCorrected = sum(reviewers, "noReviewedTranscriptCorrected");
  const r_characterCount = sum(reviewers, "characterCount");
  const r_totalCer = sum(reviewers, "totalCer");

  // Final reviewers
  const f_noFinalised = sum(finals, "noFinalised");
  const f_finalisedInMin = sum(finals, "finalisedInMin");

  return (
    <div className="w-full max-w-6xl rounded-lg p-4 space-y-4">
      <div className="font-semibold">Group Totals</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Transcribers */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="mb-2 font-medium">Transcribers</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Submitted" value={t_noSubmitted} />
              <Stat label="Reviewed (by submitted)" value={t_noReviewedBasedOnSubmitted} />
              <Stat label="Reviewed" value={t_noReviewed} />
              <Stat label="Submitted (min)" value={t_submittedInMin.toFixed(2)} />
              <Stat label="Reviewed (min)" value={t_reviewedInMin.toFixed(2)} />
              <Stat label="Trashed (min)" value={t_trashedInMin.toFixed(2)} />
              <Stat label="Syllables (reviewed)" value={t_syllableCount} />
              <Stat label="Syllables (submitted)" value={t_transcriberSyllableCount} />
              <Stat label="CER total (infer→trans)" value={t_transcriberCer} />
              <Stat label="Corrections" value={t_noTranscriptCorrected} />
              <Stat label="Chars" value={t_characterCount} />
              <Stat label="CER total (trans→reviewed)" value={t_totalCer} />
            </div>
          </div>
        </div>

        {/* Reviewers */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="mb-2 font-medium">Reviewers</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Reviewed" value={r_noReviewed} />
              <Stat label="Accepted" value={r_noAccepted} />
              <Stat label="Finalised" value={r_noFinalised} />
              <Stat label="Reviewed (min)" value={r_reviewedInMin.toFixed(2)} />
              <Stat label="Corrections" value={r_noReviewedTranscriptCorrected} />
              <Stat label="Chars" value={r_characterCount} />
              <Stat label="CER total (reviewed→final)" value={r_totalCer} />
            </div>
          </div>
        </div>

        {/* Final reviewers */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="mb-2 font-medium">Final Reviewers</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Finalised" value={f_noFinalised} />
              <Stat label="Finalised (min)" value={f_finalisedInMin.toFixed(2)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


