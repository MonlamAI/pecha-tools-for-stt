import { createLogger } from "./logger-factory";

// [Reason] Dedicated access log channel for HTTP request/response auditing
export const accessLogger = createLogger({ kind: "access", level: "info" });

export type UserIdSource =
  | "query_param"
  | "request_body"
  | "session"
  | "session_email_db_lookup"
  | "header"
  | "unknown"
  | null;

export type EmailSource = "query_param_session" | null;

export type AccessLogPayload = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: number | null;
  userIdSource?: UserIdSource;
  email?: string | null;
  emailSource?: EmailSource;
  identityVerified?: boolean;
  route?: string;
  queryParams?: Record<string, string>;
  userAgent?: string;
  ip?: string | null;
  error?: string;
  environment?: string;
  /** @deprecated Use path instead */
  url?: string;
};

// [Reason] Normalize access log shape for API routes and middleware
export function logAccess(payload: AccessLogPayload): void {
  accessLogger.info(payload, "http_access");
}
