import { logAccess, type AccessLogPayload } from "./access-logger";
import { logError } from "./error-logger";
import { resolveClientIp } from "../resolve-client-ip";
import {
  resolveAuthLogIdentity,
  runWithLoggingContext,
  type AuthLogIdentity,
} from "./resolve-auth-identity";

type RouteContext = {
  params: Record<string, string | string[]>;
};

type WrappedRouteHandler = (
  request: Request,
  context?: RouteContext
) => Promise<Response | undefined> | Response | undefined;

export type WithAccessLogOptions = {
  // [Reason] Label S2S/webhook callers when no authenticated user session is present
  service?: string;
};

const MAX_QUERY_PARAM_VALUE_LENGTH = 256;
const MAX_USER_AGENT_LENGTH = 512;
const TRUNCATION_SUFFIX = "...[truncated]";

// [Reason] Cap oversized query values to keep daily access log files readable
function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

// [Reason] Limit user agent length to prevent oversized log entries
function sanitizeUserAgent(userAgent: string | null): string | undefined {
  if (!userAgent) {
    return undefined;
  }
  return truncateValue(userAgent, MAX_USER_AGENT_LENGTH);
}

// [Reason] Truncate individual query values while preserving normal parameters
function buildQueryParams(request: Request): Record<string, string> | undefined {
  const entries = Object.fromEntries(new URL(request.url).searchParams.entries());
  if (Object.keys(entries).length === 0) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    sanitized[key] = truncateValue(value, MAX_QUERY_PARAM_VALUE_LENGTH);
  }
  return sanitized;
}

// [Reason] Derive route pattern from dynamic params for lower-cardinality reporting
function resolveRoutePattern(
  pathname: string,
  params?: Record<string, string | string[]>
): string | undefined {
  if (!params || Object.keys(params).length === 0) {
    return undefined;
  }

  let route = pathname;
  for (const [key, value] of Object.entries(params)) {
    const segments = Array.isArray(value) ? value : [value];
    for (const segment of segments) {
      if (!segment) {
        continue;
      }
      if (route.includes(segment)) {
        route = route.replace(segment, `[${key}]`);
        continue;
      }
      const encoded = encodeURIComponent(segment);
      if (encoded !== segment && route.includes(encoded)) {
        route = route.replace(encoded, `[${key}]`);
      }
    }
  }

  return route === pathname ? undefined : route;
}

function getEnvironment(): string | undefined {
  const env = process.env.NODE_ENV;
  if (env === "development" || env === "production" || env === "test") {
    return env;
  }
  return undefined;
}

function getResponseStatusCode(response: Response | undefined): number {
  return response?.status ?? 500;
}

function buildAccessLogPayload(input: {
  request: Request;
  context?: RouteContext;
  identity: AuthLogIdentity;
  response?: Response;
  durationMs: number;
  errorMessage?: string;
}): AccessLogPayload {
  const path = new URL(input.request.url).pathname;

  return {
    userId: input.identity.userId,
    userIdSource: input.identity.userIdSource,
    email: input.identity.email,
    emailSource: input.identity.emailSource,
    identityVerified: input.identity.identityVerified,
    service: input.identity.service ?? null,
    method: input.request.method,
    path,
    route: resolveRoutePattern(path, input.context?.params),
    queryParams: buildQueryParams(input.request),
    statusCode: input.errorMessage ? 500 : getResponseStatusCode(input.response),
    durationMs: input.durationMs,
    userAgent: sanitizeUserAgent(input.request.headers.get("user-agent")),
    ip: resolveClientIp(input.request),
    environment: getEnvironment(),
    ...(input.errorMessage ? { error: input.errorMessage } : {}),
  };
}

// [Reason] Wrap App Router handlers to emit structured access logs and bind ALS for nested loggers
export function withAccessLog(
  handler: (...args: [Request, RouteContext?]) => Promise<Response | undefined> | Response | undefined,
  options: WithAccessLogOptions = {}
): WrappedRouteHandler {
  return async (request: Request, context?: RouteContext) => {
    const startedAt = performance.now();
    const path = new URL(request.url).pathname;
    // [Reason] Resolve user from verified session; fall back to service label for S2S routes
    const identity = await resolveAuthLogIdentity(request, {
      service: options.service,
      path,
      // [Reason] Invalid/expired cookies on gated routes are audited by middleware via /api/internal/auth-audit
      auditInvalidSession: false,
    });

    return runWithLoggingContext(identity, request, async () => {
      try {
        const response = await handler(request, context);
        const payload = buildAccessLogPayload({
          request,
          context,
          identity,
          response,
          durationMs: Math.round(performance.now() - startedAt),
        });
        logAccess(payload);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const payload = buildAccessLogPayload({
          request,
          context,
          identity,
          durationMs: Math.round(performance.now() - startedAt),
          errorMessage,
        });
        logAccess(payload);
        logError(error, {
          method: request.method,
          path,
          route: resolveRoutePattern(path, context?.params),
        });
        throw error;
      }
    });
  };
}
