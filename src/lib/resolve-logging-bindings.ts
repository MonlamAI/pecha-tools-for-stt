import {
  getRequestContext,
  getRequestContextById,
  type RequestContext,
} from "./request-context";
import { resolveRequestId } from "./resolve-request-id";

export type LoggingBindings = {
  requestId?: string;
  identityVerified?: boolean;
  userId?: number | null;
  email?: string | null;
  userIdSource?: string | null;
  emailSource?: string | null;
  service?: string | null;
};

// [Reason] Resolve ALS first, then requestId registry, so deep service logs still get auth identity
export function resolveLoggingBindings(): LoggingBindings {
  const requestId = resolveRequestId();
  const ctx: RequestContext | undefined =
    getRequestContext() ?? getRequestContextById(requestId);

  if (!ctx && !requestId) {
    return {};
  }

  const bindings: LoggingBindings = {};
  if (requestId || ctx?.requestId) {
    bindings.requestId = ctx?.requestId ?? requestId;
  }
  if (!ctx) {
    return bindings;
  }

  bindings.identityVerified = ctx.identityVerified;
  if (ctx.userId != null) {
    bindings.userId = ctx.userId;
  }
  if (ctx.email) {
    bindings.email = ctx.email;
  }
  if (ctx.userIdSource) {
    bindings.userIdSource = ctx.userIdSource;
  }
  if (ctx.emailSource) {
    bindings.emailSource = ctx.emailSource;
  }
  if (ctx.service) {
    bindings.service = ctx.service;
  }
  return bindings;
}
