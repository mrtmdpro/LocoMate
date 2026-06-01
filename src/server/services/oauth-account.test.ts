import { describe, test, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { getTestDb } from "@/test/setup";
import { createUser } from "@/test/fixtures";
import { accounts, users } from "@/server/db/schema";
import { resolveGoogleAccount } from "./oauth-account";

function db() {
  return getTestDb() as unknown as Parameters<typeof resolveGoogleAccount>[0];
}

const expiresAtSec = Math.floor(Date.now() / 1000) + 3600;

describe("resolveGoogleAccount", () => {
  test("creates a brand-new traveler when the email is unknown", async () => {
    const res = await resolveGoogleAccount(db(), {
      googleSub: "google-sub-new",
      email: "fresh@gmail.com",
      emailVerified: true,
      name: "Fresh Traveler",
      accessTokenExpiresAtSec: expiresAtSec,
    });
    expect(res.kind).toBe("signin");
    if (res.kind !== "signin") return;
    expect(res.isNew).toBe(true);
    expect(res.role).toBe("traveler");

    const [u] = await getTestDb().select().from(users).where(eq(users.id, res.userId));
    expect(u.email).toBe("fresh@gmail.com");
    expect(u.emailVerified).toBe(true);
    const link = await getTestDb()
      .select()
      .from(accounts)
      .where(eq(accounts.providerAccountId, "google-sub-new"));
    expect(link).toHaveLength(1);
  });

  test("account-link conflict (C4): refuses to merge onto an unverified password account", async () => {
    await createUser({ email: "victim@gmail.com", emailVerified: false });
    const res = await resolveGoogleAccount(db(), {
      googleSub: "google-sub-attacker",
      email: "Victim@gmail.com",
      emailVerified: true,
      accessTokenExpiresAtSec: expiresAtSec,
    });
    expect(res.kind).toBe("error");
    if (res.kind !== "error") return;
    expect(res.code).toBe("email_exists");
    expect(res.prefillEmail).toBe("victim@gmail.com");

    // No google account row was linked to the victim.
    const link = await getTestDb()
      .select()
      .from(accounts)
      .where(eq(accounts.providerAccountId, "google-sub-attacker"));
    expect(link).toHaveLength(0);
  });

  test("auto-links to an existing account when both sides are email-verified", async () => {
    const user = await createUser({ email: "both@gmail.com", emailVerified: true });
    const res = await resolveGoogleAccount(db(), {
      googleSub: "google-sub-link",
      email: "both@gmail.com",
      emailVerified: true,
      accessTokenExpiresAtSec: expiresAtSec,
    });
    expect(res.kind).toBe("signin");
    if (res.kind !== "signin") return;
    expect(res.isNew).toBe(false);
    expect(res.userId).toBe(user.id);

    const [link] = await getTestDb()
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.provider, "google"), eq(accounts.providerAccountId, "google-sub-link")),
      );
    expect(link.userId).toBe(user.id);
  });

  test("signs in directly when the google account is already linked", async () => {
    const user = await createUser({ email: "linked@gmail.com", emailVerified: true });
    await getTestDb().insert(accounts).values({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-sub-existing",
      scope: "openid profile email",
    });
    const res = await resolveGoogleAccount(db(), {
      googleSub: "google-sub-existing",
      email: "linked@gmail.com",
      emailVerified: true,
      accessTokenExpiresAtSec: expiresAtSec,
    });
    expect(res.kind).toBe("signin");
    if (res.kind !== "signin") return;
    expect(res.userId).toBe(user.id);
    expect(res.isNew).toBe(false);
  });

  test("rejects a brand-new user whose Google email is unverified", async () => {
    const res = await resolveGoogleAccount(db(), {
      googleSub: "google-sub-unverified",
      email: "noverify@gmail.com",
      emailVerified: false,
      accessTokenExpiresAtSec: expiresAtSec,
    });
    expect(res.kind).toBe("error");
    if (res.kind !== "error") return;
    expect(res.code).toBe("unverified_google");
  });
});
