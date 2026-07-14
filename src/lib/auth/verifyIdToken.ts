// [Reason] Server-side validation of the Google id_token. Identity claims are
// never trusted from the browser; the JWT is cryptographically verified against
// Google's JWKS (signature, issuer, audience, expiry) and email_verified is
// enforced before any claim is used for provisioning.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GOOGLE_ISSUERS, GOOGLE_JWKS_URL, GOOGLE_CLIENT_ID } from "./config";

export type VerifiedIdentity = {
  email: string;
  name?: string;
  picture?: string;
};

// Cache the JWKS across invocations (module scope) to avoid refetching per login.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return jwks;
}

// [Reason] Verify the id_token JWT: signature (JWKS), issuer, audience, expiry,
// and require a verified email. Returns the trusted claims used for provisioning.
export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedIdentity | null> {
  if (!idToken) return null;
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured; cannot verify id_token.");
  }
  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: GOOGLE_CLIENT_ID,
    });

    // Never trust an unverified email for provisioning/lookup.
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!email || !emailVerified) return null;

    return {
      email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}
