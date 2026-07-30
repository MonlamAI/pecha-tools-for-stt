export const runtime = "nodejs";

// [Reason] Logout clears the session cookie and returns the user to /login,
// mirroring the Auth app's "destroy session then redirect" behavior.
import { NextResponse } from "next/server";
import { APP_BASE_URL, SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/requireUser";
import { logAuthEvent } from "@/lib/logger/auth-event-logger";
import {
  resolveAuthLogIdentity,
  runWithLoggingContext,
} from "@/lib/logger/resolve-auth-identity";

// [Reason] Use APP_BASE_URL so logout redirects stay on the public host behind
// Render's proxy (req.url is the internal upstream, e.g. localhost:10000).
async function clearAndRedirect(request?: Request) {
  // [Reason] Bind ALS so logout audit lines include requestId + verified user automatically
  const identity = await resolveAuthLogIdentity(request, {
    path: "/logout",
    auditInvalidSession: false,
  });

  return runWithLoggingContext(identity, request, async () => {
    // [Reason] Capture verified identity before clearing the cookie for audit logs
    const user = await getSessionUser();
    logAuthEvent(
      {
        event: "logout",
        userId: user?.id ?? null,
        email: user?.email ?? null,
        path: "/logout",
      },
      "User logged out"
    );

    const url = new URL("/login", APP_BASE_URL);
    const res = NextResponse.redirect(url, 302);
    res.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  });
}

export async function GET(request: Request) {
  return clearAndRedirect(request);
}

export async function POST(request: Request) {
  return clearAndRedirect(request);
}
