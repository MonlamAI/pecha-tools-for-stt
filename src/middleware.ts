// [Reason] Central authentication gate. Every page/API requires a valid session
// cookie except an explicit allowlist (auth flow, health, and internal/external
// integration endpoints that carry their own auth). Runs on the edge and only
// verifies the signed cookie; role checks happen server-side where the DB is
// available (middleware cannot query Prisma).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";

// Publicly reachable without a session cookie.
const PUBLIC_PATHS = [
  "/login",
  "/callback",
  "/logout",
  "/unauthorized",
  "/health",
  "/api/auth/session",
  // [Reason] Google OAuth login initiator must be reachable before a session exists.
  "/api/auth/google/login",
];

// Integration endpoints that authenticate via their own mechanism (API key /
// signed JWT) and are called by non-browser clients — not by our session flow.
const INTEGRATION_API_PREFIXES = [
  "/api/roles", // x-api-key protected
  "/api/sso/receiver", // portal-signed JWT
  "/api/mapping", // external tool-URL lookup
];

function isBypassed(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return INTEGRATION_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isBypassed(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) return NextResponse.next();

  // Unauthenticated: APIs get 401 JSON; pages redirect to login with returnTo.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", pathname + search);
  return NextResponse.redirect(loginUrl);
}

// [Reason] Exclude Next internals and static assets so only real routes are gated.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|svg/|.*\\..*).*)"],
};
