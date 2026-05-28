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

interface TokenPayload {
  userId: string;
  role: string;
}

export function signToken(
  payload: TokenPayload,
  expiresIn: SignOptions["expiresIn"] = "15m",
): string {
  return jwt.sign(payload, getSecret(), {
    algorithm: ALGORITHM,
    expiresIn,
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    algorithm: ALGORITHM,
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, getSecret(), {
    algorithms: [ALGORITHM],
  }) as jwt.JwtPayload;
  if (typeof decoded.userId !== "string" || typeof decoded.role !== "string") {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId, role: decoded.role };
}
