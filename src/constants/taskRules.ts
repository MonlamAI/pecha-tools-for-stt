import { Role, State } from "@prisma/client";

export const TASK_RULES: Record<Role, {
  idField: string;
  transcriptField: string;
  workingState: State;
  submitState: State;
  rejectState: State;
  trashState: State;
  historyStates: State[] | State;
  // Must match the (idField, <this>) index so history can be read in index order
  historyOrderField: "submitted_at" | "reviewed_at" | "finalised_reviewed_at";
  passedStates: State[] | State;
  completedStates: State[] | State;
}> = {
  TRANSCRIBER: {
    idField: "transcriber_id",
    transcriptField: "transcript",
    workingState: "transcribing",
    submitState: "submitted",
    rejectState: "imported",
    trashState: "trashed",
    historyStates: ["submitted", "trashed"],
    historyOrderField: "submitted_at",
    passedStates: ["accepted", "finalised"],
    completedStates: ["submitted", "accepted", "finalised"],
  },
  REVIEWER: {
    idField: "reviewer_id",
    transcriptField: "reviewed_transcript",
    workingState: "submitted",
    submitState: "accepted",
    rejectState: "transcribing",
    trashState: "trashed",
    historyStates: ["accepted", "trashed"],
    historyOrderField: "reviewed_at",
    passedStates: ["finalised"],
    completedStates: ["accepted", "finalised"],
  },
  FINAL_REVIEWER: {
    idField: "final_reviewer_id",
    transcriptField: "final_transcript",
    workingState: "accepted",
    submitState: "finalised",
    rejectState: "submitted",
    trashState: "trashed",
    historyStates: ["finalised", "trashed"],
    historyOrderField: "finalised_reviewed_at",
    passedStates: ["finalised"],
    completedStates: ["finalised"],
  },
};
