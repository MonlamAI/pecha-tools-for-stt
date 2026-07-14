export const runtime = "nodejs";

// [Reason] Logout clears the session cookie and returns the user to /login,
// mirroring the Auth app's "destroy session then redirect" behavior.
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";

function clearAndRedirect(req: Request) {
  const url = new URL("/login", req.url);
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

export async function GET(req: Request) {
  return clearAndRedirect(req);
}

export async function POST(req: Request) {
  return clearAndRedirect(req);
}
