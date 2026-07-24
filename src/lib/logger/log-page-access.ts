import { headers } from "next/headers";
import { resolveClientIpFromHeaders } from "../resolve-client-ip";
import { logAccess, type AccessLogPayload } from "./access-logger";
import {
  resolveAuthLogIdentity,
  runWithLoggingContext,
} from "./resolve-auth-identity";

const MAX_QUERY_PARAM_VALUE_LENGTH = 256;
const TRUNCATION_SUFFIX = "...[truncated]";
const MAX_USER_AGENT_LENGTH = 512;

// [Reason] Cap oversized query values in page-load access logs
function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

function sanitizeUserAgent(userAgent: string | null): string | undefined {
  if (!userAgent) {
    return undefined;
  }
  return truncateValue(userAgent, MAX_USER_AGENT_LENGTH);
}

// [Reason] Build queryParams from RSC searchParams without changing page behavior
function buildQueryParamsFromSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined
): Record<string, string> | undefined {
  if (!searchParams) {
    return undefined;
  }

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) {
      continue;
    }
    const normalized = Array.isArray(value) ? value.join(",") : String(value);
    entries[key] = truncateValue(normalized, MAX_QUERY_PARAM_VALUE_LENGTH);
  }

  return Object.keys(entries).length > 0 ? entries : undefined;
}

function getEnvironment(): string | undefined {
  const env = process.env.NODE_ENV;
  if (env === "development" || env === "production" || env === "test") {
    return env;
  }
  return undefined;
}

export type LogPageAccessInput = {
  path: string;
  /**
   * @deprecated Ignored. Identity is resolved from the authenticated session cookie.
   */
  sessionEmail?: string | null;
  statusCode?: number;
  durationMs: number;
  errorMessage?: string;
  searchParams?: Record<string, string | string[] | undefined>;
};

// [Reason] Emit access logs for App Router page loads where withAccessLog is not used
export async function logPageAccess(input: LogPageAccessInput): Promise<void> {
  try {
    const headersList = headers();
    // [Reason] Page access identity comes only from the verified auth session, not ?session=
    // [Reason] Bind ALS + requestId registry so later page/service logs inherit the user
    const identity = await resolveAuthLogIdentity();

    runWithLoggingContext(identity, undefined, () => {
      const payload: AccessLogPayload = {
        method: "GET",
        path: input.path,
        statusCode: input.errorMessage ? 500 : (input.statusCode ?? 200),
        durationMs: input.durationMs,
        email: identity.email,
        emailSource: identity.emailSource,
        userId: identity.userId,
        userIdSource: identity.userIdSource,
        identityVerified: identity.identityVerified,
        queryParams: buildQueryParamsFromSearchParams(input.searchParams),
        userAgent: sanitizeUserAgent(headersList.get("user-agent")),
        ip: resolveClientIpFromHeaders(headersList),
        environment: getEnvironment(),
        ...(input.errorMessage ? { error: input.errorMessage } : {}),
      };

      logAccess(payload);
    });
    // [Reason] Registry entry remains keyed by requestId after ALS exits for the rest of the render
  } catch {
    // Never fail page render when access logging fails
  }
}
