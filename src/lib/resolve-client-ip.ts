import { isIP } from "net";

// [Reason] Normalize proxy-provided IP values before validation
function sanitizeIpCandidate(candidate: string): string | null {
  let value = candidate.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }

  if (isIP(value) !== 0) {
    return value;
  }

  const lastColon = value.lastIndexOf(":");
  if (lastColon > 0 && value.includes(".")) {
    const host = value.slice(0, lastColon);
    if (isIP(host) !== 0) {
      return host;
    }
  }

  return null;
}

// [Reason] Shared header precedence for Request objects and Next.js headers()
export function resolveClientIpFromHeaders(headers: Headers): string | null {
  try {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) {
      for (const part of forwardedFor.split(",")) {
        const ip = sanitizeIpCandidate(part);
        if (ip) {
          return ip;
        }
      }
    }

    const realIp = headers.get("x-real-ip");
    if (realIp) {
      const ip = sanitizeIpCandidate(realIp);
      if (ip) {
        return ip;
      }
    }

  } catch {
    // Never fail the request when IP cannot be resolved
  }

  return null;
}

// [Reason] Resolve client IP using standard reverse-proxy header precedence
export function resolveClientIp(request: Request): string | null {
  try {
    const fromHeaders = resolveClientIpFromHeaders(request.headers);
    if (fromHeaders) {
      return fromHeaders;
    }

    const requestIp = (request as Request & { ip?: string }).ip;
    if (requestIp) {
      return sanitizeIpCandidate(requestIp);
    }
  } catch {
    // Never fail the request when IP cannot be resolved
  }

  return null;
}
