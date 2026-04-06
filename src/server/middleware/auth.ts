import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "locomate-dev-secret";

interface TokenPayload {
  userId: string;
  role: string;
}

export function signToken(payload: TokenPayload, expiresIn: string = "15m"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] } as jwt.SignOptions);
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" as jwt.SignOptions["expiresIn"] } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
