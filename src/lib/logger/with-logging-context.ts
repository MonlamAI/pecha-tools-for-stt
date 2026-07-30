import {
  resolveAuthLogIdentity,
  runWithLoggingContext,
  type ResolveAuthLogIdentityOptions,
} from "./resolve-auth-identity";

type RouteContext = {
  params: Record<string, string | string[]>;
};

type WrappedRouteHandler = (
  request: Request,
  context?: RouteContext
) => Promise<Response | undefined> | Response | undefined;

// [Reason] Bind ALS/registry for route handlers that need identity on nested logs without access lines
export function withLoggingContext(
  handler: (...args: [Request, RouteContext?]) => Promise<Response | undefined> | Response | undefined,
  options: ResolveAuthLogIdentityOptions = {}
): WrappedRouteHandler {
  return async (request: Request, context?: RouteContext) => {
    const path = new URL(request.url).pathname;
    const identity = await resolveAuthLogIdentity(request, {
      ...options,
      path: options.path ?? path,
    });
    return runWithLoggingContext(identity, request, () => handler(request, context));
  };
}
