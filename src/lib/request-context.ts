import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";

// [Reason] Shared header name for middleware → Node.js handler request correlation
export const REQUEST_ID_HEADER = "x-request-id";

// [Reason] Strongly typed per-request store for correlating logs across a single HTTP lifecycle
export interface RequestContext {
  requestId: string;
  // [Reason] Always explicit so mixins can emit identityVerified: false for S2S/background work
  identityVerified: boolean;
  userId?: number | null;
  email?: string | null;
  userIdSource?: string | null;
  emailSource?: string | null;
  // [Reason] Non-user principal for webhooks / service-to-service callers
  service?: string | null;
}

// [Reason] Node ALS gives each concurrent async execution chain its own isolated context
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

// [Reason] Survive Next.js RSC async boundary gaps where ALS may not propagate but requestId still does
const contextByRequestId = new Map<string, RequestContext & { boundAt: number }>();
const CONTEXT_TTL_MS = 10 * 60 * 1000;

// [Reason] Web Crypto works in Edge middleware; Node crypto is used as fallback in server routes
function randomHexByteString(byteLength: number): string {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return randomBytes(byteLength).toString("hex");
}

// [Reason] req_ + 8 hex chars matches the required correlation id format (e.g. req_3f91a7d8)
export function generateRequestId(): string {
  return `req_${randomHexByteString(4)}`;
}

// [Reason] Read middleware-forwarded request id from Headers without importing next/headers
export function resolveRequestIdFromHeaders(
  headers: Headers | { get(name: string): string | null }
): string | undefined {
  return headers.get(REQUEST_ID_HEADER) ?? undefined;
}

// [Reason] Drop stale requestId→context entries so the registry cannot grow unbounded
function sweepExpiredContexts(now = Date.now()): void {
  for (const [key, value] of contextByRequestId) {
    if (now - value.boundAt > CONTEXT_TTL_MS) {
      contextByRequestId.delete(key);
    }
  }
}

// [Reason] Register identity for mixin lookups even after nested ALS.run() exits (page renders)
export function bindRequestContextRegistry(context: RequestContext): void {
  sweepExpiredContexts();
  contextByRequestId.set(context.requestId, { ...context, boundAt: Date.now() });
}

export function unbindRequestContextRegistry(requestId: string): void {
  contextByRequestId.delete(requestId);
}

export function getRequestContextById(requestId: string | undefined): RequestContext | undefined {
  if (!requestId) {
    return undefined;
  }
  const entry = contextByRequestId.get(requestId);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.boundAt > CONTEXT_TTL_MS) {
    contextByRequestId.delete(requestId);
    return undefined;
  }
  const { boundAt: _boundAt, ...context } = entry;
  return context;
}

// [Reason] Entry point for middleware/routes to bind a requestId for the duration of a request
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  bindRequestContextRegistry(context);
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
