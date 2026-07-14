export const runtime = "nodejs";

// [Reason] Logout clears the session cookie and returns the user to /login,
// mirroring the Auth app's "destroy session then redirect" behavior.
import { NextResponse } from "next/server";
import { APP_BASE_URL, SESSION_COOKIE_NAME } from "@/lib/auth/config";

// [Reason] Use APP_BASE_URL so logout redirects stay on the public host behind
// Render's proxy (req.url is the internal upstream, e.g. localhost:10000).
function clearAndRedirect() {
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
}

export async function GET() {
  return clearAndRedirect();
}

export async function POST() {
  return clearAndRedirect();
}
