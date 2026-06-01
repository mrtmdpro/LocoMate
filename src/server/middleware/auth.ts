import jwt, { type SignOptions } from "jsonwebtoken";

// Fail loudly if the secret is missing. Falling back to a hardcoded default
// would let anyone with source access forge tokens for any user, bypassing
// both password login and Google OAuth.
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a string of at least 32 characters",
    );
  }
  return secret;
}

const ALGORITHM = "HS256" as const;

export type TokenType = "access" | "refresh";

interface TokenPayload {
  userId: string;
  role: string;
}

// Signed tokens now carry a `typ` claim so an access token can never be
// replayed where a refresh token is expected, and vice versa (closes the
// token-confusion gap). Legacy tokens minted before Cluster C have no `typ`
// claim; `verifyToken` treats those as access tokens so already-logged-in
// users are not locked out mid-rollout.
export function signToken(
  payload: TokenPayload,
  expiresIn: SignOptions["expiresIn"] = "15m",
): string {
  return jwt.sign({ ...payload, typ: "access" satisfies TokenType }, getSecret(), {
    algorithm: ALGORITHM,
    expiresIn,
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, typ: "refresh" satisfies TokenType }, getSecret(), {
    algorithm: ALGORITHM,
    expiresIn: "7d",
  });
}

/**
 * Verify a signed token and assert its type. `expectedType` defaults to
 * `"access"` since every existing call site verifies access tokens.
 *
 * Backward compatibility: tokens minted before the `typ` claim existed pass
 * the access check (a missing `typ` is treated as `"access"`). A token that
 * explicitly carries the wrong `typ` is rejected.
 */
export function verifyToken(
  token: string,
  expectedType: TokenType = "access",
): TokenPayload {
  const decoded = jwt.verify(token, getSecret(), {
    algorithms: [ALGORITHM],
  }) as jwt.JwtPayload;
  if (typeof decoded.userId !== "string" || typeof decoded.role !== "string") {
    throw new Error("Invalid token payload");
  }
  const typ = decoded.typ;
  if (typeof typ === "string" && typ !== expectedType) {
    throw new Error(`Expected ${expectedType} token, got ${typ}`);
  }
  return { userId: decoded.userId, role: decoded.role };
}
