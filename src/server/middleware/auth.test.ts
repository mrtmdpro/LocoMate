import { describe, test, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signToken, signRefreshToken, verifyToken } from "./auth";

describe("verifyToken typ enforcement", () => {
  test("an access token verifies as access", () => {
    const token = signToken({ userId: "u1", role: "traveler" });
    expect(verifyToken(token).userId).toBe("u1");
    expect(verifyToken(token, "access").role).toBe("traveler");
  });

  test("a refresh token is rejected when an access token is expected", () => {
    const token = signRefreshToken({ userId: "u1", role: "traveler" });
    expect(() => verifyToken(token, "access")).toThrow();
    // ...but verifies fine as a refresh token.
    expect(verifyToken(token, "refresh").userId).toBe("u1");
  });

  test("an access token is rejected when a refresh token is expected", () => {
    const token = signToken({ userId: "u1", role: "traveler" });
    expect(() => verifyToken(token, "refresh")).toThrow();
  });

  test("a legacy token without a typ claim still passes the access check", () => {
    // Mint a token the old way (no typ claim) to prove the rollout doesn't
    // lock out users whose tokens predate the claim.
    const legacy = jwt.sign(
      { userId: "u1", role: "traveler" },
      process.env.JWT_SECRET as string,
      { algorithm: "HS256", expiresIn: "15m" },
    );
    expect(verifyToken(legacy, "access").userId).toBe("u1");
  });
});
