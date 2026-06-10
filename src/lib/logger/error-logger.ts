import { createLogger } from "./logger-factory";
import { sanitizeStackTrace } from "./sanitize-stack-trace";

// [Reason] Separate error stream so failures are easy to tail and alert on
export const errorLogger = createLogger({ kind: "error", level: "error" });

export type ErrorLogPayload = {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

// [Reason] Consistent error serialization for API handlers and services
export function logError(error: unknown, context?: Record<string, unknown>): void {
  // [Reason] Removed temporary debug instrumentation after confirming fix
  if (error instanceof Error) {
    const payload: ErrorLogPayload = {
      message: error.message,
      // [Reason] Keep only application-relevant stack frames in persisted error logs
      stack: sanitizeStackTrace(error.stack),
      context,
    };
    errorLogger.error(payload, "application_error");
    return;
  }

  errorLogger.error(
    { message: String(error), context } satisfies ErrorLogPayload,
    "application_error"
  );
}
