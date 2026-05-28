import { hashSync } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getTestDb } from "./setup";
import {
  users,
  userProfiles,
  hostProfiles,
  experiences,
  tours,
  tourStops,
  payments,
  places,
  hostPayouts,
} from "../server/db/schema";
import { signToken, signRefreshToken } from "../server/middleware/auth";

/**
 * Factory helpers for integration tests. Each builder inserts a minimally
 * valid row and returns the full Drizzle `$inferSelect` shape so tests can
 * chain builders (e.g. createExperience needs an authorId from createUser).
 *
 * Conventions:
 *   - All fields have sensible defaults; override by passing an `overrides`
 *     object.
 *   - Returns the inserted row (not just an id) so tests assert against it.
 *   - No cross-builder side effects: call each factory explicitly when you
 *     need related rows. Explicit over implicit.
 */

type NewUser = typeof users.$inferInsert;
type NewHostProfile = typeof hostProfiles.$inferInsert;
type NewExperience = typeof experiences.$inferInsert;
type NewTour = typeof tours.$inferInsert;
type NewPayment = typeof payments.$inferInsert;
type NewPlace = typeof places.$inferInsert;
type NewTourStop = typeof tourStops.$inferInsert;
type NewHostPayout = typeof hostPayouts.$inferInsert;

// Inferred-select row shapes. Annotating factory return types explicitly
// avoids a Drizzle inference quirk where the PGlite driver's
// `.returning()` resolves to `never` once the schema graph crosses a
// certain complexity threshold (notably after the customized_tour_
// templates table was introduced). At runtime the row is the same shape
// `$inferSelect` gives us — this just helps tsc hold onto it.
type UserRow = typeof users.$inferSelect;

export async function createUser(overrides: Partial<NewUser> = {}): Promise<UserRow> {
  const db = getTestDb();
  const email = overrides.email ?? `user-${randomUUID()}@test.com`;
  const displayName = overrides.displayName ?? "Test User";
  const role = overrides.role ?? "traveler";
  const passwordHash =
    overrides.passwordHash === null
      ? null
      : overrides.passwordHash ?? hashSync("password123", 4);
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      role,
      emailVerified: overrides.emailVerified ?? true,
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();
  // Every user gets a user_profiles row in prod (auth.register creates it);
  // mirror that so downstream queries don't unexpectedly miss joins.
  await db.insert(userProfiles).values({ userId: user.id });
  return user;
}

export async function createHost(
  overrides: {
    user?: Partial<NewUser>;
    host?: Partial<NewHostProfile>;
  } = {},
) {
  const db = getTestDb();
  const user = await createUser({ role: "host", ...overrides.user });
  const [host] = await db
    .insert(hostProfiles)
    .values({
      userId: user.id,
      bio: "A friendly Hanoi local.",
      languages: ["en", "vi"],
      specialties: ["street food", "photography"],
      verificationStatus: "approved",
      verifiedAt: new Date(),
      avgRating: "4.80",
      totalReviews: 10,
      totalTours: 15,
      isAvailable: true,
      ...overrides.host,
    })
    .returning();
  return { user, host };
}

export async function createPlace(overrides: Partial<NewPlace> = {}) {
  const db = getTestDb();
  const [place] = await db
    .insert(places)
    .values({
      name: overrides.name ?? "Test Place",
      slug: overrides.slug ?? `test-place-${randomUUID().slice(0, 8)}`,
      category: overrides.category ?? "cafe",
      latitude: 21.03,
      longitude: 105.85,
      experienceTags: {},
      emotionalTags: {},
      ...overrides,
    })
    .returning();
  return place;
}

export async function createExperience(
  overrides: Partial<NewExperience> = {},
) {
  const db = getTestDb();
  const title = overrides.title ?? "Test Hanoi Experience";
  const status = overrides.status ?? "published";
  // publishedAt mirrors prod semantics: only set when status is 'published'.
  // Override via `publishedAt` field if a test needs a specific value.
  const publishedAt =
    "publishedAt" in overrides
      ? overrides.publishedAt
      : status === "published"
        ? new Date()
        : null;
  const [exp] = await db
    .insert(experiences)
    .values({
      title,
      slug:
        overrides.slug ??
        `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 6)}`,
      description:
        overrides.description ??
        "A thoughtfully curated walking tour through the Old Quarter with stops at hidden cafes.",
      category: overrides.category ?? "cultural",
      durationMinutes: overrides.durationMinutes ?? 180,
      priceAmount: overrides.priceAmount ?? 500_000,
      maxGroupSize: overrides.maxGroupSize ?? 4,
      photos: overrides.photos ?? ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
      highlights: overrides.highlights ?? ["Hidden cafe", "Temple visit"],
      included: overrides.included ?? ["Water bottle"],
      schedule: overrides.schedule ?? [{ time: "09:00", label: "Meet at Hoan Kiem Lake" }],
      kind: overrides.kind ?? "curated",
      status,
      publishedAt,
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();
  return exp;
}

export async function createTour(overrides: Partial<NewTour> = {}) {
  const db = getTestDb();
  if (!overrides.userId) {
    throw new Error("createTour: userId is required");
  }
  const [tour] = await db
    .insert(tours)
    .values({
      userId: overrides.userId,
      status: overrides.status ?? "preview",
      requestParams: overrides.requestParams ?? {
        date: new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        durationHours: 3,
        budgetLevel: "medium",
        interests: ["culture"],
        withHost: false,
        groupSize: 1,
      },
      tourData: overrides.tourData ?? { title: "Custom Hanoi tour", stops: [] },
      packageType: overrides.packageType ?? "loco_route",
      priceAmount: overrides.priceAmount ?? 250_000,
      ...overrides,
    })
    .returning();
  return tour;
}

export async function createPayment(overrides: Partial<NewPayment> = {}) {
  const db = getTestDb();
  if (!overrides.tourId) {
    throw new Error("createPayment: tourId is required");
  }
  const [payment] = await db
    .insert(payments)
    .values({
      tourId: overrides.tourId,
      userId: overrides.userId ?? null,
      amount: overrides.amount ?? 250_000,
      currency: overrides.currency ?? "VND",
      paymentMethod: overrides.paymentMethod ?? "card",
      paymentGateway: overrides.paymentGateway ?? "stripe_test",
      status: overrides.status ?? "pending",
      ...overrides,
    })
    .returning();
  return payment;
}

export async function createTourStop(overrides: Partial<NewTourStop> = {}) {
  const db = getTestDb();
  if (!overrides.tourId) {
    throw new Error("createTourStop: tourId is required");
  }
  const [stop] = await db
    .insert(tourStops)
    .values({
      tourId: overrides.tourId,
      placeId: overrides.placeId ?? null,
      stopOrder: overrides.stopOrder ?? 0,
      durationMinutes: overrides.durationMinutes ?? 30,
      ...overrides,
    })
    .returning();
  return stop;
}

export async function createHostPayout(overrides: Partial<NewHostPayout> = {}) {
  const db = getTestDb();
  if (!overrides.hostId) {
    throw new Error("createHostPayout: hostId is required");
  }
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400_000);
  const [payout] = await db
    .insert(hostPayouts)
    .values({
      hostId: overrides.hostId,
      amount: overrides.amount ?? 1_000_000,
      currency: overrides.currency ?? "VND",
      status: overrides.status ?? "paid",
      periodStart: overrides.periodStart ?? weekStart,
      periodEnd: overrides.periodEnd ?? now,
      paidAt: overrides.paidAt ?? now,
      ...overrides,
    })
    .returning();
  return payout;
}

/** Wraps the real JWT signer so tests cover the same token shape prod uses. */
export function signTokenFor(user: { id: string; role: string }) {
  return {
    accessToken: signToken({ userId: user.id, role: user.role }),
    refreshToken: signRefreshToken({ userId: user.id, role: user.role }),
  };
}
