// [Reason] Google OAuth 2.0 Authorization Code Flow helpers. Builds the
// authorization URL and performs the server-side code->token exchange (which
// requires the client secret and therefore must never run in the browser).
// ID token verification lives in ./verifyIdToken to keep responsibilities split.
import {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES,
} from "./config";

export type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

// [Reason] Build the Google authorization URL for the code flow. `state` is a
// server-generated random value echoed back on the callback for CSRF protection.
export function getGoogleAuthUrl(state: string): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured; cannot start login.");
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state,
    // Ask for a fresh account selection instead of silently reusing a session.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

// [Reason] Exchange the one-time authorization code for tokens. Uses the client
// secret + the exact redirect_uri that was sent on the authorization request.
export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse | null> {
  if (!code) return null;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured; cannot exchange code."
    );
  }

  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as GoogleTokenResponse;
  } catch {
    return null;
  }
}
