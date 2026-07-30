// [Reason] Dedicated admin landing reached from the FINAL_REVIEWER-only "Admin"
// tile on the home page. Surfaces exactly the four admin areas requested:
// Dashboard (users/groups/departments), Reports, Statistics, and CSV Upload.
// Each target route is independently FINAL_REVIEWER-guarded by its own layout.
import Link from "next/link";

export const dynamic = "force-dynamic";

const ADMIN_CARDS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Manage users, groups, and departments",
  },
  { href: "/report", label: "Reports", description: "Review task reports" },
  { href: "/stats", label: "Statistics", description: "View task statistics" },
  { href: "/task", label: "CSV Upload", description: "Upload tasks via CSV" },
];

export default function AdminHome() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-900">
      {/* [Reason] Dark header so the plain-white Admin title stays readable. */}
      <header className="w-full border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          {/* [Reason] Keep Admin title as plain white (no gradient), matching home. */}
          <h1 className="text-xl sm:text-2xl font-bold text-white">Admin</h1>
          <Link href="/" className="btn btn-sm btn-ghost text-neutral-200">
            Back to tools
          </Link>
        </div>
      </header>

      <main className="flex-1 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-6">
            Admin area
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ADMIN_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-300 hover:shadow-xl shadow-sm transition-all duration-300 p-6 text-center cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="rounded-full bg-slate-50 dark:bg-neutral-700 w-20 h-20 flex items-center justify-center text-2xl font-bold text-blue-600">
                  {card.label.charAt(0)}
                </div>
                <span className="uppercase text-slate-700 dark:text-neutral-200 font-semibold tracking-wide text-sm">
                  {card.label}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 normal-case">
                  {card.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
