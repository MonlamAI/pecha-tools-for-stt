// [Reason] Restrict /task (CSV upload UI) to FINAL_REVIEWER. Non-admins redirect
// to /unauthorized.
import { requireFinalReviewerPage } from "@/lib/auth/requireUser";

export const dynamic = "force-dynamic";

export default async function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFinalReviewerPage();
  return <>{children}</>;
}
