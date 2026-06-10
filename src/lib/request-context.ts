import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";

// [Reason] Shared header name for middleware → Node.js handler request correlation
export const REQUEST_ID_HEADER = "x-request-id";

// [Reason] Strongly typed per-request store for correlating logs across a single HTTP lifecycle
export interface RequestContext {
  requestId: string;
}

// [Reason] Node ALS gives each concurrent async execution chain its own isolated context
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

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

// [Reason] Entry point for middleware/routes to bind a requestId for the duration of a request
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
