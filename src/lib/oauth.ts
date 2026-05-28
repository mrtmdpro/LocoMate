import { Google } from "arctic";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface GoogleIdTokenClaims extends JWTPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Built per request (not a module-level singleton) because Next.js route
// handlers are serverless-friendly and env vars are only guaranteed to be
// populated at request time.
export function googleClient(): Google {
  const base = requireEnv("OAUTH_REDIRECT_BASE").replace(/\/$/, "");
  return new Google(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    `${base}/api/auth/google/callback`,
  );
}

export function googleRedirectUri(): string {
  const base = requireEnv("OAUTH_REDIRECT_BASE").replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

// Lazy singleton JWKS (cached across hot-reloads / warm invocations).
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
function googleJwks() {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs"),
    );
  }
  return jwksCache;
}

// Verifies Google's id_token signature + iss + aud + exp. Throws on failure.
// Signature verification is required; do NOT decode claims with jwtDecode and
// trust them.
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<GoogleIdTokenClaims> {
  const { payload } = await jwtVerify(idToken, googleJwks(), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: requireEnv("GOOGLE_CLIENT_ID"),
  });
  if (typeof payload.sub !== "string") {
    throw new Error("Google id_token missing 'sub'");
  }
  if (typeof payload.email !== "string") {
    throw new Error("Google id_token missing 'email'");
  }
  if (typeof payload.email_verified !== "boolean") {
    throw new Error("Google id_token missing 'email_verified'");
  }
  return payload as GoogleIdTokenClaims;
}
