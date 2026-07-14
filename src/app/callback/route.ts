export const runtime = "nodejs";

// [Reason] Server-side Google OAuth callback (Authorization Code Flow). Validates
// the CSRF `state`, exchanges the code for tokens, verifies the id_token, then
// hands the trusted email to the EXISTING provisioning + session logic. The
// browser never sees Google tokens, and no token/role/group is stored in the
// session (role/group always load fresh from the STT DB).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@/lib/auth/google";
import { verifyGoogleIdToken } from "@/lib/auth/verifyIdToken";
import { getOrCreateUser } from "@/service/user-service";
import { createSessionToken } from "@/lib/auth/session";
import {
  APP_BASE_URL,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE,
  RETURN_TO_COOKIE,
} from "@/lib/auth/config";

// [Reason] Any failure returns the user to /login with a generic error rather
// than leaking details; the transient OAuth cookies are cleared on the way out.
// [Reason] Use APP_BASE_URL so redirects stay on the public host behind Render's proxy
// (req.url is the internal upstream, e.g. localhost:10000).
function failToLogin(code: string) {
  const url = new URL("/login", APP_BASE_URL);
  url.searchParams.set("error", code);
  const res = NextResponse.redirect(url, 302);
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(RETURN_TO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code") || "";
  const state = searchParams.get("state") || "";
  const oauthError = searchParams.get("error");

  // User denied consent or Google returned an error.
  if (oauthError) return failToLogin("access_denied");

  // [Reason] CSRF check: the state echoed by Google must equal the one we set
  // in the HttpOnly cookie when starting the login.
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return failToLogin("invalid_state");
  }

  // Exchange the authorization code for tokens (server-side, uses client secret).
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens?.id_token) return failToLogin("token_exchange_failed");

  // [Reason] Cryptographically validate the id_token before trusting any claim.
  const identity = await verifyGoogleIdToken(tokens.id_token);
  if (!identity) return failToLogin("invalid_token");

  // [Reason] Provision/lookup via the EXISTING STT logic (default role
  // TRANSCRIBER, group_id 0). STT DB remains the source of truth.
  const user = await getOrCreateUser({ username: identity.email });
  if (!user || "error" in user) return failToLogin("user_provisioning_failed");

  const token = await createSessionToken({ userId: user.id, email: user.email });

  // Restore the intended destination (validated as path-relative at login time).
  const rawReturnTo = req.cookies.get(RETURN_TO_COOKIE)?.value || "/";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";

  // [Reason] Resolve against APP_BASE_URL (public env URL), not req.url, so
  // Render's internal host (localhost:10000) never appears in Location.
  const res = NextResponse.redirect(new URL(returnTo, APP_BASE_URL), 302);
  // [Reason] HTTP-only signed session cookie; Secure in prod, Lax so the
  // top-level OAuth redirect can set it while blocking cross-site CSRF.
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  // Clear the one-time OAuth cookies now that the session is established.
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(RETURN_TO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
