export const runtime = "nodejs";

// [Reason] Legacy endpoint that turned a client-posted id_token into a session
// cookie. Superseded by the server-side /callback route in the Google code flow
// (the browser no longer receives an id_token). Kept temporarily for a
// compile-safe migration; slated for removal in Phase 3.
import { NextResponse } from "next/server";
import { verifyGoogleIdToken } from "@/lib/auth/verifyIdToken";
import { getOrCreateUser } from "@/service/user-service";
import { createSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/config";

export async function POST(req: Request) {
  let idToken = "";
  try {
    const body = await req.json();
    idToken = String(body?.idToken || "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // [Reason] Cryptographically validate the token before trusting any claim.
  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // [Reason] Lookup only — email must already exist in the User table.
  const user = await getOrCreateUser({ username: identity.email });
  if (!user || "error" in user) {
    return NextResponse.json(
      { error: (user as any)?.error || "User is not allowed to log in." },
      { status: 403 }
    );
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });

  const res = NextResponse.json({ ok: true });
  // [Reason] HTTP-only signed session cookie; Secure in prod, Lax to allow the
  // top-level Auth0 redirect to set it while blocking cross-site CSRF.
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
