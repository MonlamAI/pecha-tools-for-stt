import UserClient from "./UserClient";
import { logPageAccess } from "@/lib/logger";

// [Reason] Server wrapper so page-access logging works with staging's client report UI
export default async function User({ searchParams, params }) {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/report/user/[id]",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
    searchParams,
  });
  return <UserClient searchParams={searchParams} params={params} />;
}
