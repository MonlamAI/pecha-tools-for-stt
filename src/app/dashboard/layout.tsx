// [Reason] Restrict all /dashboard/* pages (department/group/user/task admin) to
// FINAL_REVIEWER. Non-admins are redirected to /unauthorized even on direct URLs.
import { requireFinalReviewerPage } from "@/lib/auth/requireUser";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFinalReviewerPage();
  return <>{children}</>;
}
