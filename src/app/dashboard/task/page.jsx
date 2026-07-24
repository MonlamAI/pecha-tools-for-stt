import TaskClient from "./TaskClient";
import { logPageAccess } from "@/lib/logger";

// [Reason] Server wrapper so page-access logging works with staging's client task UI
export default async function Task({ searchParams }) {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/dashboard/task",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
    searchParams,
  });
  return <TaskClient searchParams={searchParams} />;
}
