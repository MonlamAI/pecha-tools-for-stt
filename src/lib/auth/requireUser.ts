// [Reason] Single source of truth for "who is the authenticated user" on the
// server. Reads the signed cookie, then loads the real STT user (role/group) from
// the database so authorization always uses DB state, never client-supplied values.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import prisma from "@/service/db";
import type { Role } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "./config";
import { verifySessionToken } from "./session";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  group_id: number;
  role: Role;
  group: { name: string | null } | null;
};

// [Reason] Resolve the authenticated STT user from the session cookie, or null.
// Loading from DB (not the cookie) keeps role/group authoritative and current.
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      group_id: true,
      role: true,
      group: { select: { name: true } },
    },
  });
  return user;
}

export function isFinalReviewer(user: SessionUser | null): boolean {
  return user?.role === "FINAL_REVIEWER";
}

// [Reason] Guard for protected APIs: returns the user or a ready-to-return 401.
export async function requireApiUser(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

// [Reason] Guard for admin-only APIs: FINAL_REVIEWER is the agreed authorization
// source (no new Admin role). Returns the user or a 401/403 response.
export async function requireFinalReviewerApi(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.role !== "FINAL_REVIEWER") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user };
}

// [Reason] Guard for admin server actions (dashboard mutations). Throws when the
// caller is not a FINAL_REVIEWER so the mutation cannot run.
export async function assertFinalReviewer(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "FINAL_REVIEWER") throw new Error("Forbidden");
  return user;
}

// [Reason] Guard for admin PAGES (server component layouts). Redirects
// unauthenticated users to /login and non-admins to /unauthorized, blocking
// direct URL access to dashboard/reports/stats/uploads.
export async function requireFinalReviewerPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "FINAL_REVIEWER") redirect("/unauthorized");
  return user;
}
