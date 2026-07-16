import { createLogger } from "./logger-factory";
import { sanitizeStackTrace } from "./sanitize-stack-trace";
import { resolveLoggingBindings } from "../resolve-logging-bindings";

// [Reason] Separate error stream so failures are easy to tail and alert on
export const errorLogger = createLogger({ kind: "error", level: "error" });

export type ErrorLogPayload = {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

const SENSITIVE_CONTEXT_KEYS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "idToken",
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "cookies",
  "password",
  "token",
  "sessionToken",
  "SESSION_SECRET",
  "authorizationCode",
]);

// [Reason] Strip secrets/tokens from error context while preserving debugging metadata
function sanitizeErrorContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_CONTEXT_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

// [Reason] Attach requestId + auth/service identity from ALS/registry without caller boilerplate
function enrichErrorContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  const bindings = resolveLoggingBindings();
  const base = sanitizeErrorContext(context) ?? {};

  for (const [key, value] of Object.entries(bindings)) {
    if (base[key] == null && value !== undefined) {
      base[key] = value;
    }
  }

  return Object.keys(base).length > 0 ? base : undefined;
}

// [Reason] Consistent error serialization for API handlers and services
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const enrichedContext = enrichErrorContext(context);

  if (error instanceof Error) {
    const payload: ErrorLogPayload = {
      message: error.message,
      // [Reason] Keep only application-relevant stack frames in persisted error logs
      stack: sanitizeStackTrace(error.stack),
      context: enrichedContext,
    };
    errorLogger.error(payload, "application_error");
    return;
  }

  errorLogger.error(
    { message: String(error), context: enrichedContext } satisfies ErrorLogPayload,
    "application_error"
  );
}
