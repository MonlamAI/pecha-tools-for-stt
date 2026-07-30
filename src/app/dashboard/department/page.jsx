import DepartmentClient from "./DepartmentClient";
import { logPageAccess } from "@/lib/logger";

// [Reason] Server wrapper so page-access logging works with staging's client department UI
export default async function Department() {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/dashboard/department",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return <DepartmentClient />;
}
