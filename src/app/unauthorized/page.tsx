// [Reason] Shared 403 page shown when a non-FINAL_REVIEWER tries to reach an
// admin route (dashboard/reports/stats/uploads) directly.
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-5xl font-bold text-neutral-800 dark:text-neutral-100">403</h1>
        <p className="mt-3 text-lg text-neutral-500">
          You don&apos;t have permission to access this page.
        </p>
      </div>
      <Link href="/" className="btn btn-accent">
        Back to Home
      </Link>
    </div>
  );
}
