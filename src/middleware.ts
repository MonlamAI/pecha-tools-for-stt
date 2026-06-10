import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateRequestId, REQUEST_ID_HEADER } from "@/lib/request-context";

// [Reason] Assign a unique requestId per HTTP request and forward it to Node.js route handlers
export function middleware(request: NextRequest) {
  const requestId = generateRequestId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(REQUEST_ID_HEADER, requestId);

  return response;
}

// [Reason] Run on all app/API requests while skipping static assets
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
