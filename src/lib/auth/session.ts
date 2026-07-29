// [Reason] Signed session helpers for middleware + route handlers. Use jose
// subpaths (not the barrel) so Edge middleware does not pull JWE/CompressionStream.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { SESSION_MAX_AGE_SECONDS } from "./config";

export type SessionPayload = {
  // Minimal identity only. Role/group are always loaded fresh from the STT DB so
  // admin changes take effect without waiting for the cookie to expire.
  userId: number;
  email: string;
};

// [Reason] Fail fast if the signing secret is missing rather than issuing
// unsigned/guessable sessions.
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not set or too short (min 16 chars). Refusing to sign sessions."
    );
  }
  return new TextEncoder().encode(secret);
}

// [Reason] Issue a short-lived HS256 JWT carrying only the user id + email.
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

// [Reason] Verify signature + expiry; return null on any failure so callers can
// treat invalid/expired/tampered cookies uniformly as "not authenticated".
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = Number(payload.sub);
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}
