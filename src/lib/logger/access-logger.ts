import { createLogger } from "./logger-factory";

// [Reason] Dedicated access log channel for HTTP request/response auditing
export const accessLogger = createLogger({ kind: "access", level: "info" });

export type UserIdSource =
  | "auth_session"
  | "service"
  /** @deprecated Untrusted client source; no longer written by access logging */
  | "query_param"
  /** @deprecated Untrusted client source; no longer written by access logging */
  | "request_body"
  /** @deprecated Prefer auth_session from the signed cookie */
  | "session"
  /** @deprecated Legacy ?session= email lookup; replaced by auth_session */
  | "session_email_db_lookup"
  /** @deprecated Untrusted client source; no longer written by access logging */
  | "header"
  | "unknown"
  | null;

export type EmailSource =
  | "auth_session"
  /** @deprecated Legacy ?session= email lookup; replaced by auth_session */
  | "query_param_session"
  | null;

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
  // [Reason] Service principal for webhooks / S2S endpoints without a user session
  service?: string | null;
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
