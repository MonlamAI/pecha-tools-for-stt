// [Reason] Restrict all /report/* pages to FINAL_REVIEWER (replaces the old
// client-only NEXT_PUBLIC_PASSWORD gate). Non-admins redirect to /unauthorized.
import { requireFinalReviewerPage } from "@/lib/auth/requireUser";

export const dynamic = "force-dynamic";

export default async function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFinalReviewerPage();
  return <>{children}</>;
}
