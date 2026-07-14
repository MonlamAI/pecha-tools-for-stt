export const runtime = "nodejs";

// [Reason] Login initiator for the Google Authorization Code Flow. Generates a
// CSRF `state`, stashes it (and the intended return destination) in short-lived
// HttpOnly cookies, then 302-redirects the browser to Google's consent screen.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getGoogleAuthUrl } from "@/lib/auth/google";
import { OAUTH_STATE_COOKIE, RETURN_TO_COOKIE } from "@/lib/auth/config";

export async function GET(req: NextRequest) {
  // Only accept internal, path-relative return targets to avoid open redirects.
  const rawReturnTo = req.nextUrl.searchParams.get("returnTo") || "/";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";

  // [Reason] Random, unguessable state bound to this browser via an HttpOnly
  // cookie; the callback rejects any mismatch (CSRF protection).
  const state = randomBytes(32).toString("hex");

  const res = NextResponse.redirect(getGoogleAuthUrl(state), 302);

  const shortLived = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 minutes: enough to complete the round-trip.
  };
  res.cookies.set(OAUTH_STATE_COOKIE, state, shortLived);
  res.cookies.set(RETURN_TO_COOKIE, returnTo, shortLived);
  return res;
}
