import StatsClient from "./StatsClient";
import { logPageAccess } from "@/lib/logger";

// [Reason] Server wrapper so page-access logging works with staging's client stats UI
export default async function Stats() {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/stats",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return <StatsClient />;
}
