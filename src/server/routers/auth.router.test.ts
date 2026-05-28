import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { getTestDb } from "@/test/setup";
import { userProfiles, users } from "@/server/db/schema";

describe("auth.register", () => {
  test("traveler signup leaves user_profiles.onboardingCompleted=false (traveler onboarding is required)", async () => {
    const caller = await callerAs(null);
    const result = await caller.auth.register({
      email: "new-traveler@test.com",
      password: "password123",
      displayName: "New Traveler",
      role: "traveler",
    });
    const [profile] = await getTestDb()
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, result.user.id));
    expect(profile.onboardingCompleted).toBe(false);
  });

  test("host signup marks onboardingCompleted=true so login doesn't bounce to /onboarding", async () => {
    // Regression guard for the "host redirected to /onboarding on login"
    // bug. Hosts don't do the traveler intent flow; their onboarding is
    // host-setup + ID verification, so the traveler-only /onboarding page
    // is never the right destination for them.
    const caller = await callerAs(null);
    const result = await caller.auth.register({
      email: "new-host@test.com",
      password: "password123",
      displayName: "New Host",
      role: "host",
    });
    expect(result.user.role).toBe("host");

    const [profile] = await getTestDb()
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, result.user.id));
    expect(profile.onboardingCompleted).toBe(true);
  });

  test("host login returns onboardingCompleted=true so the login handler skips /onboarding", async () => {
    const caller = await callerAs(null);
    await caller.auth.register({
      email: "host-login@test.com",
      password: "password123",
      displayName: "Host Login",
      role: "host",
    });
    const login = await caller.auth.login({
      email: "host-login@test.com",
      password: "password123",
    });
    expect(login.user.role).toBe("host");
    expect(login.user.onboardingCompleted).toBe(true);
  });

  test("register lowercases email so re-login with mixed-case input still finds the row", async () => {
    const caller = await callerAs(null);
    await caller.auth.register({
      email: "Mixed.Case@TEST.com",
      password: "password123",
      displayName: "Mixed",
      role: "traveler",
    });
    const [row] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.email, "mixed.case@test.com"));
    expect(row).toBeDefined();
    expect(row.email).toBe("mixed.case@test.com");
  });
});
