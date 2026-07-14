// [Reason] Central Google OAuth + session configuration so login, callback,
// verification, and middleware all read the same values instead of duplicating
// env access. Replaces the previous Auth0 configuration.

// Server-side only Google OAuth credentials used by the token exchange and the
// id_token verifier. The client secret must never reach the browser.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

// Google OAuth 2.0 endpoints (Authorization Code Flow).
export const GOOGLE_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Google id_tokens are issued with either of these issuer values; accept both.
export const GOOGLE_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
];

// JWKS used to cryptographically verify the id_token signature.
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

// OpenID scopes required to receive an id_token with email + profile claims.
export const GOOGLE_SCOPES = "openid email profile";

// [Reason] Absolute redirect URI must match the one registered in Google Cloud
// Console byte-for-byte, so it is derived from APP_BASE_URL rather than the
// incoming request origin (which can differ behind proxies).
export const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
export const GOOGLE_REDIRECT_URI = `${APP_BASE_URL}/callback`;

// Session cookie: HTTP-only, signed JWT. Name is distinct from the Auth portal's
// `_session_pechatool` cookie to avoid collisions if apps ever share a domain.
export const SESSION_COOKIE_NAME = "_session_pecha_stt";

// [Reason] Short-lived HttpOnly cookies used only during the OAuth round-trip:
// `oauth_state` guards against CSRF; `return_to` preserves the intended landing
// page across the redirect to Google and back.
export const OAUTH_STATE_COOKIE = "_pecha_stt_oauth_state";
export const RETURN_TO_COOKIE = "_pecha_stt_return_to";

// Absolute session lifetime (12h ≈ a work day; no silent refresh exists upstream).
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
