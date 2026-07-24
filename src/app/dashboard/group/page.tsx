import GroupClient from "./GroupClient";
import { logPageAccess } from "@/lib/logger";

// [Reason] Server wrapper so page-access logging works with staging's client group UI
export default async function Group() {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/dashboard/group",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return <GroupClient />;
}
