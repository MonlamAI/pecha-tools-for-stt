import { getRequestId, REQUEST_ID_HEADER } from "./request-context";

// [Reason] Bridge middleware-set x-request-id into Pino logs on the Node.js server runtime
export function resolveRequestId(): string | undefined {
  const fromAsyncLocalStorage = getRequestId();
  if (fromAsyncLocalStorage) {
    return fromAsyncLocalStorage;
  }

  try {
    const { headers } = require("next/headers") as typeof import("next/headers");
    return headers().get(REQUEST_ID_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}
