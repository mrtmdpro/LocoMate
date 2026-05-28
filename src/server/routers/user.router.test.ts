import { describe, test, expect } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import {
  createUser,
  createHost,
  createExperience,
  createTour,
} from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import {
  users,
  experiences,
  tours,
  hostProfiles,
  userProfiles,
} from "@/server/db/schema";
import { hashSync } from "bcryptjs";

describe("user.becomeHost", () => {
  test("promotes a traveler to host and creates a pending hostProfiles row", async () => {
    const user = await createUser({ role: "traveler" });
    const caller = await callerAs(user);
    const result = await caller.user.becomeHost();
    expect(result.role).toBe("host");

    const [after] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(after.role).toBe("host");

    const hp = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, user.id));
    expect(hp).toHaveLength(1);
    expect(hp[0].verificationStatus).toBe("pending");
  });

  test("marks traveler onboarding complete so login doesn't bounce the user back", async () => {
    // Regression guard for: host accounts were being redirected to
    // /onboarding on every login because user_profiles.onboardingCompleted
    // defaulted to false. becomeHost must flip it true as part of the role
    // transition so the traveler-only onboarding page is never the right
    // destination after this call.
    const user = await createUser({ role: "traveler" });
    const caller = await callerAs(user);
    await caller.user.becomeHost();

    const [profile] = await getTestDb()
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id));
    expect(profile.onboardingCompleted).toBe(true);
  });

  test("is idempotent: calling twice does not duplicate the hostProfiles row", async () => {
    const user = await createUser({ role: "traveler" });
    const caller = await callerAs(user);
    await caller.user.becomeHost();
    await caller.user.becomeHost();
    const hp = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, user.id));
    expect(hp).toHaveLength(1);
  });

  test("preserves an existing hostProfile's verification status (no clobbering)", async () => {
    // User was already a verified host from an earlier path (e.g. register as
    // host + host-setup). Calling becomeHost must NOT reset their approval.
    const { user, host } = await createHost({
      user: { role: "host" },
      host: { verificationStatus: "approved" },
    });
    const caller = await callerAs(user);
    await caller.user.becomeHost();

    const [hp] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(hp.verificationStatus).toBe("approved");
  });

  test("does not demote an admin", async () => {
    const admin = await createUser({ role: "admin" });
    const caller = await callerAs(admin);
    await caller.user.becomeHost();
    const [after] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, admin.id));
    expect(after.role).toBe("admin");
  });

  test("rejects unauthenticated callers", async () => {
    const caller = await callerAs(null);
    await expect(caller.user.becomeHost()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("user.becomeTraveler", () => {
  test("demotes a host: role flips, isAvailable=false, verificationStatus preserved", async () => {
    const { user, host } = await createHost({
      user: { role: "host" },
      host: { verificationStatus: "approved", isAvailable: true },
    });
    const caller = await callerAs(user);
    const result = await caller.user.becomeTraveler();
    expect(result.role).toBe("traveler");
    expect(result.listingsUnpublished).toBe(0);

    const [after] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(after.role).toBe("traveler");

    const [hp] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(hp.isAvailable).toBe(false);
    // Verification must survive the demotion so the user can re-toggle host
    // without losing approval. Mirrors the becomeHost "preserves status" case.
    expect(hp.verificationStatus).toBe("approved");
  });

  test("drafts only published experiences authored by the user", async () => {
    const { user } = await createHost();
    const otherHost = await createHost();

    const pub1 = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Mine published 1",
    });
    const pub2 = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Mine published 2",
    });
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
      title: "Mine draft",
    });
    const archived = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "archived",
      title: "Mine archived",
    });
    const otherPub = await createExperience({
      authorId: otherHost.user.id,
      kind: "host_custom",
      status: "published",
      title: "Other host published",
    });

    const caller = await callerAs(user);
    const result = await caller.user.becomeTraveler();
    expect(result.listingsUnpublished).toBe(2);

    const rows = await getTestDb().select().from(experiences);
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    expect(byId.get(pub1.id)?.status).toBe("draft");
    expect(byId.get(pub2.id)?.status).toBe("draft");
    expect(byId.get(draft.id)?.status).toBe("draft");
    expect(byId.get(archived.id)?.status).toBe("archived");
    // Other host's published listing must NOT be touched.
    expect(byId.get(otherPub.id)?.status).toBe("published");
  });

  test("is idempotent: calling on a traveler is a no-op", async () => {
    const user = await createUser({ role: "traveler" });
    const caller = await callerAs(user);
    const result = await caller.user.becomeTraveler();
    expect(result.role).toBe("traveler");
    expect(result.listingsUnpublished).toBe(0);

    const [after] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(after.role).toBe("traveler");
    // Traveler never had a host_profiles row; the no-op must not create one.
    const hp = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, user.id));
    expect(hp).toHaveLength(0);
  });

  test("blocks with PRECONDITION_FAILED when host has a paid tour", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
    });

    const caller = await callerAs(user);
    await expect(caller.user.becomeTraveler()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });

    // Role and listings must not have changed.
    const [after] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(after.role).toBe("host");
  });

  test("blocks with PRECONDITION_FAILED when host has an active tour", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "active",
    });

    const caller = await callerAs(user);
    await expect(caller.user.becomeTraveler()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("does not block on completed or cancelled tours", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "completed",
    });
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "system_cancelled",
    });

    const caller = await callerAs(user);
    const result = await caller.user.becomeTraveler();
    expect(result.role).toBe("traveler");
  });

  test("does not demote an admin", async () => {
    const admin = await createUser({ role: "admin" });
    const caller = await callerAs(admin);
    const result = await caller.user.becomeTraveler();
    expect(result.role).toBe("admin");

    const [after] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, admin.id));
    expect(after.role).toBe("admin");
  });

  test("rejects unauthenticated callers", async () => {
    const caller = await callerAs(null);
    await expect(caller.user.becomeTraveler()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("end-to-end re-toggle: becomeHost -> becomeTraveler -> becomeHost keeps same host_profile id and verificationStatus", async () => {
    const { user, host } = await createHost({
      user: { role: "host" },
      host: { verificationStatus: "approved" },
    });
    const caller = await callerAs(user);

    await caller.user.becomeTraveler();
    // becomeHost requires the role to be flipped first; the dormant
    // host_profiles row must be reused (not duplicated).
    await caller.user.becomeHost();

    const hps = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, user.id));
    expect(hps).toHaveLength(1);
    expect(hps[0].id).toBe(host.id);
    expect(hps[0].verificationStatus).toBe("approved");
  });
});

describe("user.deleteAccount", () => {
  test("host with published experiences: experiences archive, tours.hostId nulls, user deleted", async () => {
    // Regression guard for the "marketplace orphan on user delete" class of
    // bugs surfaced in the UI review. Must hold end-to-end in one tx.
    const password = "password123";
    const { user, host } = await createHost({
      user: {
        email: "departing-host@test.com",
        passwordHash: hashSync(password, 4),
      },
    });
    // Host has two published listings and one draft, plus one paid booking.
    const exp1 = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Will be archived 1",
    });
    const exp2 = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Will be archived 2",
    });
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
      title: "Also archived",
    });
    const traveler = await createUser();
    const tour = await createTour({
      userId: traveler.id,
      hostId: host.id,
      experienceId: exp1.id,
      status: "paid",
    });

    const caller = await callerAs(user);
    await caller.user.deleteAccount({
      confirmEmail: "departing-host@test.com",
      currentPassword: password,
    });

    // Users row is gone.
    const [remaining] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(remaining).toBeUndefined();

    // hostProfiles cascaded.
    const [hp] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(hp).toBeUndefined();

    // All three experiences were archived (schema FK also nulled authorId).
    const surviving = await getTestDb()
      .select()
      .from(experiences)
      .where(isNull(experiences.authorId));
    expect(surviving).toHaveLength(3);
    for (const row of surviving) {
      expect(row.status).toBe("archived");
    }

    // The traveler's paid tour survives but hostId is null now.
    const [t] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(t).toBeDefined();
    expect(t.hostId).toBeNull();
    expect(t.experienceId).toBe(exp1.id); // SET NULL vs SET NULL — experience still referenced
  });

  test("non-host user delete still works (no experiences / tours to detach)", async () => {
    const password = "password123";
    const user = await createUser({
      email: "plain@test.com",
      passwordHash: hashSync(password, 4),
    });
    const caller = await callerAs(user);
    await caller.user.deleteAccount({
      confirmEmail: "plain@test.com",
      currentPassword: password,
    });
    const [remaining] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(remaining).toBeUndefined();
  });

  test("rejects mismatched email confirmation", async () => {
    const user = await createUser({ email: "real@test.com" });
    const caller = await callerAs(user);
    await expect(
      caller.user.deleteAccount({
        confirmEmail: "wrong@test.com",
        currentPassword: "password123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("rejects wrong password for password users", async () => {
    const password = "password123";
    const user = await createUser({
      email: "pwguarded@test.com",
      passwordHash: hashSync(password, 4),
    });
    const caller = await callerAs(user);
    await expect(
      caller.user.deleteAccount({
        confirmEmail: "pwguarded@test.com",
        currentPassword: "definitely-not-the-password",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("rejects unauthenticated callers (UNAUTHORIZED)", async () => {
    // Destructive procedure must require auth. src/test/README.md mandates
    // this negative for every protected procedure.
    const caller = await callerAs(null);
    await expect(
      caller.user.deleteAccount({
        confirmEmail: "does-not-matter@test.com",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("OAuth-only user (no passwordHash) skips password check", async () => {
    const user = await createUser({
      email: "oauth-only@test.com",
      passwordHash: null,
    });
    const caller = await callerAs(user);
    await caller.user.deleteAccount({
      confirmEmail: "oauth-only@test.com",
    });
    const [remaining] = await getTestDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(remaining).toBeUndefined();
  });
});
