import { logAccess, type AccessLogPayload, type UserIdSource } from "./access-logger";
import { logError } from "./error-logger";
import { resolveClientIp } from "../resolve-client-ip";
import { getSessionParamFromRequest, resolveSessionIdentity } from "./resolve-session-identity";

type RouteContext = {
  params: Record<string, string | string[]>;
};

type WrappedRouteHandler = (
  request: Request,
  context?: RouteContext
) => Promise<Response | undefined> | Response | undefined;

type ApiUserIdentity = {
  userId: number | null;
  userIdSource: UserIdSource;
};

type AccessIdentity = {
  userId: number | null;
  userIdSource: UserIdSource;
  email: string | null;
  emailSource: AccessLogPayload["emailSource"];
  identityVerified: false;
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

function parsePositiveUserId(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

// [Reason] Preserve existing API identity sources before session email lookup
async function resolveApiUserIdentity(request: Request): Promise<ApiUserIdentity> {
  const unresolved: ApiUserIdentity = { userId: null, userIdSource: null };

  try {
    const url = new URL(request.url);

    const fromQuery = parsePositiveUserId(url.searchParams.get("userId"));
    if (fromQuery != null) {
      return { userId: fromQuery, userIdSource: "query_param" };
    }

    const fromHeader = parsePositiveUserId(request.headers.get("x-user-id"));
    if (fromHeader != null) {
      return { userId: fromHeader, userIdSource: "header" };
    }

    const fromSessionHeader = parsePositiveUserId(request.headers.get("x-session-user-id"));
    if (fromSessionHeader != null) {
      return { userId: fromSessionHeader, userIdSource: "session" };
    }

    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD") {
      return unresolved;
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return unresolved;
    }

    const cloned = request.clone();
    const body = (await cloned.json()) as Record<string, unknown>;
    for (const key of ["userId", "id"]) {
      const parsed = parsePositiveUserId(body[key]);
      if (parsed != null) {
        return { userId: parsed, userIdSource: "request_body" };
      }
    }
  } catch {
    // Never fail the request when userId cannot be resolved
  }

  return unresolved;
}

// [Reason] Merge API userId sources with optional ?session= email DB lookup for access logs
async function resolveAccessIdentity(request: Request): Promise<AccessIdentity> {
  const apiIdentity = await resolveApiUserIdentity(request);
  const sessionParam = getSessionParamFromRequest(request);
  const sessionIdentity = await resolveSessionIdentity(sessionParam);

  return {
    userId: apiIdentity.userId ?? sessionIdentity.userId,
    userIdSource: apiIdentity.userIdSource ?? sessionIdentity.userIdSource,
    email: sessionIdentity.email,
    emailSource: sessionIdentity.emailSource,
    identityVerified: false,
  };
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
  identity: AccessIdentity;
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

// [Reason] Wrap App Router handlers to emit structured access logs without changing route logic
export function withAccessLog(
  handler: (...args: [Request, RouteContext?]) => Promise<Response | undefined> | Response | undefined
): WrappedRouteHandler {
  return async (request: Request, context?: RouteContext) => {
    const startedAt = performance.now();
    const identity = await resolveAccessIdentity(request);

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
      // [Reason] Removed temporary debug instrumentation after confirming fix
      // [Reason] Ensure unhandled route exceptions are also written to the error log without changing responses
      logError(error, {
        method: request.method,
        path: new URL(request.url).pathname,
        route: resolveRoutePattern(new URL(request.url).pathname, context?.params),
        userId: identity.userId,
        userIdSource: identity.userIdSource,
        email: identity.email,
        emailSource: identity.emailSource,
      });
      // [Reason] Rethrow so Next.js error handling remains unchanged after access log is written
      throw error;
    }
  };
}
