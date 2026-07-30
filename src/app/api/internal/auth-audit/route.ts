export const runtime = "nodejs";

// [Reason] Edge middleware cannot write Pino file logs; it posts invalid-session audits here.
import { NextResponse } from "next/server";
import { logAuthEvent, type AuthEventName } from "@/lib/logger/auth-event-logger";
import {
  resolveAuthLogIdentity,
  runWithLoggingContext,
} from "@/lib/logger/resolve-auth-identity";

const ALLOWED_EVENTS: AuthEventName[] = ["invalid_session", "login_failure"];

function isAuthorized(request: Request): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return false;
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    event?: string;
    reason?: string;
    path?: string;
    method?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as AuthEventName | undefined;
  if (!event || !ALLOWED_EVENTS.includes(event)) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  }

  // [Reason] Bind requestId from middleware for correlation; never treat this as a user session
  const identity = await resolveAuthLogIdentity(request, {
    service: "auth_audit",
    auditInvalidSession: false,
    path: "/api/internal/auth-audit",
  });

  return runWithLoggingContext(identity, request, () => {
    // [Reason] Audit metadata only — callers must never send cookies/tokens in the body
    logAuthEvent(
      {
        event,
        reason: body.reason || "unspecified",
        path: body.path,
      },
      event === "invalid_session"
        ? "Invalid or expired session cookie"
        : "User login failed"
    );
    return NextResponse.json({ ok: true }, { status: 202 });
  });
}
