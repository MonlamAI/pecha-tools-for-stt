// [Reason] Restrict the /admin landing page to FINAL_REVIEWER, mirroring the
// existing dashboard/report/stats/task guards so direct URL access by non-admins
// is redirected to /unauthorized.
import { requireFinalReviewerPage } from "@/lib/auth/requireUser";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFinalReviewerPage();
  return <>{children}</>;
}
