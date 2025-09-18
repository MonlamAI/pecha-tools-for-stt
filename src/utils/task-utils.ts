"use server";

import { Role } from "@prisma/client";
import { TASK_RULES } from "@/constants/taskRules";

export function getInitialTranscript(task: any, role: Role) {
  const rule = TASK_RULES[role];
  if (!rule) return "";

  const transcriptValue = task?.[rule.transcriptField];
  if (transcriptValue != null && transcriptValue !== "") {
    return transcriptValue;
  }

  // fallback logic: e.g., for transcriber use inference_transcript
  if (role === "TRANSCRIBER") return task?.inference_transcript || "";
  if (role === "REVIEWER") return task?.transcript || "";

  return "";
}
