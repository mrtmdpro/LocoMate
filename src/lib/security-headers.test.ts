import { describe, expect, test } from "vitest";
import { buildSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  test("provides baseline browser hardening headers", () => {
    const headers = buildSecurityHeaders();
    const byKey = new Map(headers.map((header) => [header.key, header.value]));

    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(byKey.get("Permissions-Policy")).toContain("camera=()");
    expect(byKey.get("Content-Security-Policy-Report-Only")).toContain(
      "default-src 'self'",
    );
  });

  test("keeps configured remote image domains in the CSP image allowlist", () => {
    const csp = buildSecurityHeaders().find(
      (header) => header.key === "Content-Security-Policy-Report-Only",
    )?.value;

    expect(csp).toContain("images.unsplash.com");
    expect(csp).toContain("randomuser.me");
    expect(csp).toContain("images.pexels.com");
    expect(csp).toContain("upload.wikimedia.org");
    expect(csp).toContain("lh3.googleusercontent.com");
  });
});
