import { appLogger } from "./app-logger";

export type AuthEventName =
  | "login_success"
  | "login_failure"
  | "logout"
  | "invalid_session";

export type AuthEventPayload = {
  event: AuthEventName;
  userId?: number | null;
  email?: string | null;
  reason?: string;
  path?: string;
};

// [Reason] Standardize auth audit events without logging tokens, cookies, or OAuth payloads
export function logAuthEvent(payload: AuthEventPayload, message: string): void {
  const { event, userId, email, reason, path } = payload;
  appLogger.info(
    {
      event,
      ...(userId != null ? { userId } : {}),
      ...(email ? { email } : {}),
      ...(reason ? { reason } : {}),
      ...(path ? { path } : {}),
      identityVerified: userId != null,
    },
    message
  );
}
