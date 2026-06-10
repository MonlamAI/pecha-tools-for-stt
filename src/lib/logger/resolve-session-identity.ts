import prisma from "@/service/db";
import type { EmailSource, UserIdSource } from "./access-logger";

export type SessionIdentity = {
  email: string | null;
  emailSource: EmailSource;
  userId: number | null;
  userIdSource: UserIdSource;
  identityVerified: false;
};

const UNRESOLVED_SESSION_IDENTITY: SessionIdentity = {
  email: null,
  emailSource: null,
  userId: null,
  userIdSource: null,
  identityVerified: false,
};

// [Reason] Read-only DB lookup for access logs; does not create users or change app auth
export async function resolveSessionIdentity(
  sessionParam: string | null | undefined
): Promise<SessionIdentity> {
  if (sessionParam == null || String(sessionParam).trim() === "") {
    return UNRESOLVED_SESSION_IDENTITY;
  }

  const email = String(sessionParam).trim();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return {
      email,
      emailSource: "query_param_session",
      userId: user?.id ?? null,
      userIdSource: user ? "session_email_db_lookup" : null,
      identityVerified: false,
    };
  } catch {
    return {
      email,
      emailSource: "query_param_session",
      userId: null,
      userIdSource: null,
      identityVerified: false,
    };
  }
}

// [Reason] Extract ?session= email from incoming request URL for access log correlation
export function getSessionParamFromRequest(request: Request): string | null {
  try {
    const session = new URL(request.url).searchParams.get("session");
    return session && session.trim() !== "" ? session.trim() : null;
  } catch {
    return null;
  }
}
