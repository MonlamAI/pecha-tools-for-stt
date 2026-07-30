import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import {
  generateRequestId,
  getRequestContext,
  resolveRequestIdFromHeaders,
  runWithRequestContext,
  unbindRequestContextRegistry,
  type RequestContext,
} from "../request-context";
import { resolveRequestId } from "../resolve-request-id";
import type { EmailSource, UserIdSource } from "./access-logger";
import { logAuthEvent } from "./auth-event-logger";

export type AuthLogIdentity = {
  userId: number | null;
  userIdSource: UserIdSource;
  email: string | null;
  emailSource: EmailSource;
  identityVerified: boolean;
  service?: string | null;
};

export type ResolveAuthLogIdentityOptions = {
  // [Reason] Mark webhook / S2S callers with a service principal when no user session exists
  service?: string | null;
  // [Reason] Avoid duplicate invalid-session events when middleware already audited the failure
  auditInvalidSession?: boolean;
  path?: string;
};

const UNRESOLVED_AUTH_IDENTITY: AuthLogIdentity = {
  userId: null,
  userIdSource: null,
  email: null,
  emailSource: null,
  identityVerified: false,
};

// [Reason] Parse a single cookie value from a Cookie header without trusting client identity fields
function getCookieFromHeader(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key === name) {
      const raw = trimmed.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

function identityFromPayload(userId: number, email: string): AuthLogIdentity {
  return {
    userId,
    userIdSource: "auth_session",
    email: email || null,
    emailSource: email ? "auth_session" : null,
    identityVerified: true,
  };
}

function serviceIdentity(service: string): AuthLogIdentity {
  return {
    userId: null,
    userIdSource: "service",
    email: null,
    emailSource: null,
    identityVerified: false,
    service,
  };
}

// [Reason] Prefer already-bound context so each request resolves the session once
function identityFromRequestContext(): AuthLogIdentity | null {
  const ctx = getRequestContext();
  if (!ctx) {
    return null;
  }
  if (ctx.identityVerified === true && ctx.userId != null) {
    return {
      userId: ctx.userId,
      userIdSource: (ctx.userIdSource as UserIdSource) ?? "auth_session",
      email: ctx.email ?? null,
      emailSource: (ctx.emailSource as EmailSource) ?? (ctx.email ? "auth_session" : null),
      identityVerified: true,
      service: ctx.service ?? null,
    };
  }
  if (ctx.service) {
    return {
      userId: null,
      userIdSource: "service",
      email: null,
      emailSource: null,
      identityVerified: false,
      service: ctx.service,
    };
  }
  return null;
}

async function readSessionToken(request?: Request): Promise<string | null> {
  if (request) {
    return getCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  }
  try {
    return cookies().get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

// [Reason] Verified session cookie is the sole trusted user identity source for logs
export async function resolveAuthLogIdentity(
  request?: Request,
  options: ResolveAuthLogIdentityOptions = {}
): Promise<AuthLogIdentity> {
  const fromContext = identityFromRequestContext();
  if (fromContext) {
    return fromContext;
  }

  try {
    const token = await readSessionToken(request);
    if (token) {
      const payload = await verifySessionToken(token);
      if (payload) {
        return identityFromPayload(payload.userId, payload.email);
      }

      // [Reason] Cookie present but unverifiable → expired/tampered; opt-in to avoid duplicate middleware audits
      if (options.auditInvalidSession === true) {
        logAuthEvent(
          {
            event: "invalid_session",
            reason: "expired_or_invalid_cookie",
            path: options.path,
          },
          "Invalid or expired session cookie"
        );
      }
      if (options.service) {
        return serviceIdentity(options.service);
      }
      return UNRESOLVED_AUTH_IDENTITY;
    }
  } catch {
    // Never fail callers when identity resolution fails
  }

  if (options.service) {
    return serviceIdentity(options.service);
  }

  return UNRESOLVED_AUTH_IDENTITY;
}

function toRequestContext(
  identity: AuthLogIdentity,
  requestId: string
): RequestContext {
  return {
    requestId,
    identityVerified: identity.identityVerified,
    userId: identity.identityVerified ? identity.userId : null,
    email: identity.identityVerified ? identity.email : null,
    userIdSource: identity.userIdSource,
    emailSource: identity.emailSource,
    service: identity.service ?? null,
  };
}

// [Reason] Bind requestId + auth/service identity into ALS + registry for deep logger mixins
export function runWithLoggingContext<T>(
  identity: AuthLogIdentity,
  request: Request | undefined,
  fn: () => T
): T {
  const requestId =
    resolveRequestId() ??
    (request ? resolveRequestIdFromHeaders(request.headers) : undefined) ??
    generateRequestId();

  return runWithRequestContext(toRequestContext(identity, requestId), fn);
}

// [Reason] Background/cron work must never inherit or invent an authenticated user
export function runBackgroundLoggingContext<T>(jobName: string, fn: () => T): T {
  return runWithRequestContext(
    {
      requestId: generateRequestId(),
      identityVerified: false,
      userId: null,
      email: null,
      userIdSource: "service",
      emailSource: null,
      service: jobName,
    },
    fn
  );
}

// [Reason] Allow API wrappers to drop registry entries after the response is finished
export function releaseLoggingContext(requestId: string | undefined): void {
  if (requestId) {
    unbindRequestContextRegistry(requestId);
  }
}
