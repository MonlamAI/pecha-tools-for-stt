// [Reason] Public login page. Already-authenticated users skip the login screen.
// The client component now only triggers the server-driven Google OAuth flow, so
// no provider config is passed to the browser (the client secret stays server-side).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/requireUser";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already authenticated users skip the login screen.
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
