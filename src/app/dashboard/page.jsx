import React from "react";
import Link from "next/link";
import { logPageAccess } from "@/lib/logger";

// [Reason] Made async to enable server-side page access logging while keeping staging UI
const Dashboard = async () => {
  const startedAt = performance.now();
  await logPageAccess({
    path: "/dashboard",
    statusCode: 200,
    durationMs: Math.round(performance.now() - startedAt),
  });
  const links = ["department", "group", "user"];
  return (
    <div className="h-screen flex flex-col sm:flex-row justify-center items-center space-y-5 space-x-0 sm:space-y-0 sm:space-x-5">
      {links.map((link) => (
        <Link
          key={link}
          href={`/dashboard/${link}`}
          className="btn btn-accent text-base text-center w-1/2 sm:text-xl sm:w-1/5"
          type="button"
        >
          {link}
        </Link>
      ))}
    </div>
  );
};

export default Dashboard;
