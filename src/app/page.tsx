// [Reason] Home is the authenticated Tool Selection landing. Scoped to a focused
// set of tiles: Speech To Text for everyone, plus an Admin tile shown only to
// FINAL_REVIEWER users that opens the dedicated /admin landing.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, isFinalReviewer } from "@/lib/auth/requireUser";
import { TOOLS } from "@/data/tools";
import { logPageAccess } from "@/lib/logger/log-page-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const startedAt = performance.now();
  // Middleware already enforces auth; this is defense-in-depth + gives us the user.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const admin = isFinalReviewer(user);

  // [Reason] Log page-load access; identity is resolved from the verified auth session
  await logPageAccess({
    path: "/",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
  });

  // [Reason] Build the tile list: the shared worker tools plus an admin-only
  // "Admin" entry. Non-admins never see the Admin tile.
  const tiles = [
    ...TOOLS.map((tool) => ({
      key: tool.name,
      label: tool.label,
      href: tool.href,
      external: tool.external,
    })),
    ...(admin
      ? [{ key: "admin", label: "Admin", href: "/admin", external: false }]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-900">
      {/* [Reason] Dark header so the plain-white Monlam Tools title stays readable. */}
      <header className="w-full border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          {/* [Reason] Keep brand title as plain white (no gradient) on the landing header. */}
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Monlam Tools
          </h1>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-neutral-300">
              {user.name || user.email}
            </span>
            <a href="/logout" className="btn btn-sm btn-ghost text-neutral-200">
              Sign out
            </a>
          </div>
        </div>
      </header>

      {/* TOOL GRID */}
      <main className="flex-1 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-6">
            Select a tool
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tiles.map((tool) => {
              const cardClass =
                "group rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-300 hover:shadow-xl shadow-sm transition-all duration-300 p-6 text-center cursor-pointer flex flex-col items-center gap-4";
              const inner = (
                <>
                  <div className="rounded-full bg-slate-50 dark:bg-neutral-700 w-20 h-20 flex items-center justify-center text-2xl font-bold text-blue-600">
                    {tool.label.charAt(0)}
                  </div>
                  <span className="uppercase text-slate-700 dark:text-neutral-200 font-semibold tracking-wide text-sm">
                    {tool.label}
                  </span>
                </>
              );
              return tool.external ? (
                <a
                  key={tool.key}
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardClass}
                >
                  {inner}
                </a>
              ) : (
                <Link key={tool.key} href={tool.href} className={cardClass}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
