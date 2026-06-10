// [Reason] Central authentication gate. Every page/API requires a valid session
// cookie except an explicit allowlist (auth flow, health, and internal/external
// integration endpoints that carry their own auth). Runs on the edge and only
// verifies the signed cookie; role checks happen server-side where the DB is
// available (middleware cannot query Prisma).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";

// [Reason] Inline edge-safe requestId helpers so middleware does not import Node ALS (async_hooks)
const REQUEST_ID_HEADER = "x-request-id";

function generateRequestId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `req_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

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

  // [Reason] Assign a unique requestId per HTTP request and forward it to Node.js route handlers
  const requestId = generateRequestId();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const withRequestId = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };

  if (isBypassed(pathname)) {
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } })
    );
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } })
    );
  }

  // Unauthenticated: APIs get 401 JSON; pages redirect to login with returnTo.
  if (pathname.startsWith("/api/")) {
    return withRequestId(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", pathname + search);
  return withRequestId(NextResponse.redirect(loginUrl));
}

// [Reason] Exclude Next internals and static assets so only real routes are gated.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\..*).*)"],
};
