import UserClient from "./UserClient";
import { logPageAccess } from "@/lib/logger";

// [Reason] Server wrapper so page-access logging works with staging's client user UI
export default async function User({ searchParams }) {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/dashboard/user",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
    searchParams,
  });
  return <UserClient searchParams={searchParams} />;
}
