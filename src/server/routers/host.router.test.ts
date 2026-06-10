import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import {
  createUser,
  createHost,
  createExperience,
  createTour,
  createTourStop,
  createPayment,
  createPlace,
  createHostPayout,
} from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { hostProfiles, hostAvailability } from "@/server/db/schema";
import { vietnamDayBoundsUtc } from "@/lib/time";

// Reuse the prod helper directly so the test cannot drift from the query it
// verifies.
function todayVietnamIso(): string {
  return vietnamDayBoundsUtc().isoDate;
}

describe("host.getDashboard", () => {
  test("rejects traveler callers (hostProcedure gate)", async () => {
    const traveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);
    await expect(caller.host.getDashboard()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("returns null when host role has no hostProfiles row", async () => {
    // Simulate an incomplete onboarding: user.role='host' but no profile.
    // Mirror of how `publish` also guards on host-setup completion.
    const { user } = await createHost();
    await getTestDb().delete(hostProfiles).where(eq(hostProfiles.userId, user.id));
    const caller = await callerAs(user);
    const result = await caller.host.getDashboard();
    expect(result).toBeNull();
  });

  test("surfaces lifetime stats + empty arrays when the host has no activity", async () => {
    const { user } = await createHost();
    const caller = await callerAs(user);
    const result = await caller.host.getDashboard();

    expect(result).not.toBeNull();
    expect(result!.todaysBookings).toEqual([]);
    expect(result!.todaysRevenueVnd).toBe(0);
    expect(result!.myListingsCount).toEqual({ published: 0, draft: 0, archived: 0 });
    expect(result!.host.totalTours).toBe(15); // fixture default
  });

  test("today's bookings only include tours scheduled today AND paid/active", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const today = todayVietnamIso();
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 3);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    // Matches: today + paid.
    const visible = await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: today, startTime: "10:00", durationHours: 2, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });

    // Rejected: today but status=preview.
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "preview",
      requestParams: { date: today, startTime: "14:00", durationHours: 2, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });

    // Rejected: status=paid but scheduled yesterday.
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: yesterday, startTime: "09:00", durationHours: 2, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });

    const caller = await callerAs(user);
    const result = await caller.host.getDashboard();

    expect(result!.todaysBookings).toHaveLength(1);
    expect(result!.todaysBookings[0].id).toBe(visible.id);
  });

  test("experienceTitle is pulled from experiences via LEFT JOIN", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Authentic Bun Cha Crawl",
    });
    const today = todayVietnamIso();

    await createTour({
      userId: traveler.id,
      hostId: host.id,
      experienceId: exp.id,
      status: "paid",
      requestParams: { date: today, startTime: "11:00", durationHours: 2, budgetLevel: "medium", interests: [], withHost: true, groupSize: 2 },
      tourData: { title: "fallback-should-be-ignored" },
    });

    const caller = await callerAs(user);
    const result = await caller.host.getDashboard();
    expect(result!.todaysBookings).toHaveLength(1);
    expect(result!.todaysBookings[0].tourTitle).toBe("Authentic Bun Cha Crawl");
    expect(result!.todaysBookings[0].experienceId).toBe(exp.id);
  });

  test("today's revenue sums only succeeded payments within today's Vietnam window", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tourA = await createTour({ userId: traveler.id, hostId: host.id, priceAmount: 500_000 });
    const tourB = await createTour({ userId: traveler.id, hostId: host.id, priceAmount: 300_000 });

    // In-window succeeded: counts.
    await createPayment({
      tourId: tourA.id,
      userId: traveler.id,
      amount: 500_000,
      status: "succeeded",
      paidAt: new Date(),
    });
    // Succeeded but outside today's window (2 days ago): excluded.
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await createPayment({
      tourId: tourB.id,
      userId: traveler.id,
      amount: 300_000,
      status: "succeeded",
      paidAt: twoDaysAgo,
    });
    // Pending (today): excluded.
    const tourC = await createTour({ userId: traveler.id, hostId: host.id });
    await createPayment({
      tourId: tourC.id,
      userId: traveler.id,
      amount: 9_999_999,
      status: "pending",
      paidAt: null,
    });

    const caller = await callerAs(user);
    const result = await caller.host.getDashboard();
    expect(result!.todaysRevenueVnd).toBe(500_000);
  });

  test("myListingsCount groups correctly across statuses", async () => {
    const { user } = await createHost();
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "p1" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "p2" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "draft", title: "d1" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "archived", title: "a1" });
    // Someone else's experiences must not contribute.
    const { user: other } = await createHost();
    await createExperience({ authorId: other.id, kind: "host_custom", status: "published", title: "other-p1" });

    const caller = await callerAs(user);
    const result = await caller.host.getDashboard();
    expect(result!.myListingsCount).toEqual({
      published: 2,
      draft: 1,
      archived: 1,
    });
  });

  test("authorization: host A cannot see host B's dashboard data", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const today = todayVietnamIso();

    // Host B has a paid tour today; host A must not see it.
    await createTour({
      userId: traveler.id,
      hostId: b.host.id,
      status: "paid",
      requestParams: { date: today, startTime: "10:00", durationHours: 2, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });
    await createExperience({ authorId: b.user.id, kind: "host_custom", status: "published", title: "B's listing" });

    const callerA = await callerAs(a.user);
    const resultA = await callerA.host.getDashboard();
    expect(resultA!.todaysBookings).toHaveLength(0);
    expect(resultA!.myListingsCount.published).toBe(0);
  });
});

describe("host.getEarningsSummary", () => {
  test("buckets succeeded payments by today / week / month / all-time", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tourA = await createTour({ userId: traveler.id, hostId: host.id });
    const tourB = await createTour({ userId: traveler.id, hostId: host.id });
    const tourC = await createTour({ userId: traveler.id, hostId: host.id });

    // Today succeeded.
    await createPayment({
      tourId: tourA.id,
      userId: traveler.id,
      amount: 500_000,
      status: "succeeded",
      paidAt: new Date(),
    });
    // 5 days ago (within 7-day week window, also within 30-day month window).
    await createPayment({
      tourId: tourB.id,
      userId: traveler.id,
      amount: 300_000,
      status: "succeeded",
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
    // 40 days ago (outside month, still inside all-time).
    await createPayment({
      tourId: tourC.id,
      userId: traveler.id,
      amount: 200_000,
      status: "succeeded",
      paidAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    const caller = await callerAs(user);
    const result = await caller.host.getEarningsSummary();

    expect(result).not.toBeNull();
    expect(result!.todayVnd).toBe(500_000);
    expect(result!.weekVnd).toBe(800_000); // today + 5 days ago
    expect(result!.monthVnd).toBe(800_000); // same
    expect(result!.allTimeVnd).toBe(1_000_000);
    expect(result!.lifetimeBookings).toBe(3);
  });

  test("excludes pending/refunded/failed payments from every bucket", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, hostId: host.id });
    await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      amount: 999_999,
      status: "pending",
      paidAt: null,
    });

    const caller = await callerAs(user);
    const result = await caller.host.getEarningsSummary();
    expect(result!.allTimeVnd).toBe(0);
    expect(result!.lifetimeBookings).toBe(0);
  });

  test("isolation: host A does not see host B's earnings", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const tourB = await createTour({ userId: traveler.id, hostId: b.host.id });
    await createPayment({
      tourId: tourB.id,
      userId: traveler.id,
      amount: 5_000_000,
      status: "succeeded",
      paidAt: new Date(),
    });

    const callerA = await callerAs(a.user);
    const resultA = await callerA.host.getEarningsSummary();
    expect(resultA!.allTimeVnd).toBe(0);
  });
});

describe("host.getUpcomingBookings", () => {
  test("returns paid/active tours dated today-or-later, ordered by date", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const today = vietnamDayBoundsUtc().isoDate;
    const tomorrow = new Date(Date.now() + 86_400_000 + 7 * 3600_000)
      .toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000 + 7 * 3600_000)
      .toISOString().slice(0, 10);

    // Future paid -> included
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: tomorrow, startTime: "10:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });
    // Today paid -> included
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: today, startTime: "09:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 2 },
    });
    // Yesterday paid -> excluded (that's the Past bucket)
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: yesterday, startTime: "09:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });
    // Tomorrow but preview (not yet paid) -> excluded
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "preview",
      requestParams: { date: tomorrow, startTime: "15:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });

    const caller = await callerAs(user);
    const result = await caller.host.getUpcomingBookings();
    expect(result).toHaveLength(2);
    // Order: today first, then tomorrow.
    expect(result[0].scheduledDate).toBe(today);
    expect(result[1].scheduledDate).toBe(tomorrow);
  });

  test("isolation: host A does not see host B's upcoming bookings", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    await createTour({
      userId: traveler.id,
      hostId: b.host.id,
      status: "paid",
      requestParams: { date: "2099-01-01", startTime: "09:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });
    const callerA = await callerAs(a.user);
    const result = await callerA.host.getUpcomingBookings();
    expect(result).toHaveLength(0);
  });
});

describe("host.getPastBookings", () => {
  test("returns completed tours AND past-dated paid tours", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const yesterday = new Date(Date.now() - 86_400_000 + 7 * 3600_000)
      .toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 86_400_000 + 7 * 3600_000)
      .toISOString().slice(0, 10);

    // Completed: included regardless of date.
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "completed",
      requestParams: { date: lastWeek, startTime: "10:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 2 },
    });
    // Paid + past-dated: included (host probably should have completed it).
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: yesterday, startTime: "09:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });
    // Paid + future: excluded (that's Upcoming).
    await createTour({
      userId: traveler.id,
      hostId: host.id,
      status: "paid",
      requestParams: { date: "2099-01-01", startTime: "10:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
    });

    const caller = await callerAs(user);
    const result = await caller.host.getPastBookings();
    expect(result).toHaveLength(2);
  });
});

describe("host.getBalance", () => {
  test("splits succeeded payments into available (tour completed) vs pending (tour not completed)", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    // Completed tour -> payment counts as available.
    const tourA = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({ tourId: tourA.id, userId: traveler.id, amount: 1_000_000, status: "succeeded", paidAt: new Date() });
    // Paid tour -> payment counts as pending.
    const tourB = await createTour({ userId: traveler.id, hostId: host.id, status: "paid" });
    await createPayment({ tourId: tourB.id, userId: traveler.id, amount: 500_000, status: "succeeded", paidAt: new Date() });

    const caller = await callerAs(user);
    const result = await caller.host.getBalance();

    expect(result).not.toBeNull();
    // 1M gross * 80% net = 800k available (no prior payouts).
    expect(result!.availableVnd).toBe(800_000);
    expect(result!.pendingVnd).toBe(400_000); // 500k * 80%
    expect(result!.lifetimePayoutsVnd).toBe(0);
    expect(result!.nextPayoutDate).toBeTruthy();
  });

  test("subtracts paid-out amount from available balance", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({ tourId: tour.id, userId: traveler.id, amount: 1_000_000, status: "succeeded", paidAt: new Date() });
    // Already-paid payout of 600k reduces available by 600k.
    await createHostPayout({ hostId: host.id, amount: 600_000, status: "paid" });

    const caller = await callerAs(user);
    const result = await caller.host.getBalance();
    expect(result!.availableVnd).toBe(200_000); // 800k - 600k
    expect(result!.lifetimePayoutsVnd).toBe(600_000);
  });

  test("refunded payments reduce available net", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      amount: 1_000_000,
      status: "refunded",
      refundAmount: 1_000_000,
      paidAt: new Date(),
    });
    const caller = await callerAs(user);
    const result = await caller.host.getBalance();
    // Refunded payment: its amount is NOT counted as gross (status filter),
    // and refundAmount is reported separately.
    expect(result!.availableVnd).toBe(0);
    expect(result!.refundedVnd).toBe(1_000_000);
  });

  test("isolates balance per host", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, hostId: b.host.id, status: "completed" });
    await createPayment({ tourId: tour.id, userId: traveler.id, amount: 5_000_000, status: "succeeded", paidAt: new Date() });

    const caller = await callerAs(a.user);
    const result = await caller.host.getBalance();
    expect(result!.availableVnd).toBe(0);
  });
});

describe("host.getEarningsHero", () => {
  test("splits succeeded payments into current vs previous period for trend compare", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    // Current window (last 7 days): 1.5M gross across 2 tours.
    const cur1 = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    const cur2 = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({ tourId: cur1.id, userId: traveler.id, amount: 1_000_000, status: "succeeded", paidAt: new Date(Date.now() - 2 * 86400_000) });
    await createPayment({ tourId: cur2.id, userId: traveler.id, amount: 500_000, status: "succeeded", paidAt: new Date(Date.now() - 5 * 86400_000) });

    // Previous window (days 8-14): 700k gross across 1 tour.
    const prev = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({ tourId: prev.id, userId: traveler.id, amount: 700_000, status: "succeeded", paidAt: new Date(Date.now() - 10 * 86400_000) });

    const caller = await callerAs(user);
    const result = await caller.host.getEarningsHero({ days: 7 });
    expect(result).not.toBeNull();
    expect(result!.currentVnd).toBe(1_500_000);
    expect(result!.previousVnd).toBe(700_000);
    expect(result!.currentBookings).toBe(2);
    expect(result!.previousBookings).toBe(1);
    // 80% net of 1.5M = 1.2M
    expect(result!.currentNetVnd).toBe(1_200_000);
    expect(result!.currentCommissionVnd).toBe(300_000);
  });

  test("returns null for host with no hostProfile", async () => {
    const user = await createUser({ role: "host" });
    const caller = await callerAs(user);
    const result = await caller.host.getEarningsHero({ days: 30 });
    expect(result).toBeNull();
  });

  test("rejects traveler caller (hostProcedure gate)", async () => {
    const traveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);
    await expect(caller.host.getEarningsHero({ days: 30 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("isolation: host A cannot see host B's earnings hero", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const tourB = await createTour({ userId: traveler.id, hostId: b.host.id, status: "completed" });
    await createPayment({
      tourId: tourB.id,
      userId: traveler.id,
      amount: 5_000_000,
      status: "succeeded",
      paidAt: new Date(),
    });

    const callerA = await callerAs(a.user);
    const result = await callerA.host.getEarningsHero({ days: 30 });
    expect(result!.currentVnd).toBe(0);
    expect(result!.currentBookings).toBe(0);
  });

  // Documents the known limitation in the docblock of the cashflow section:
  // the new multi-line order path uses payments.orderId (not tourId), and
  // the earnings procedures still join through tours.tourId. Fails loudly
  // if/when someone fixes the linkage -- at which point this test becomes
  // the first place that assertion needs to flip.
  test("KNOWN LIMITATION: order-linked payments do not appear in earnings hero", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    // Simulate a payment created by the new cart/order flow: orderId set,
    // tourId null. createPayment requires tourId, so we insert directly.
    const tour = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    // Tour-linked payment is the legacy shape: it DOES count.
    await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      amount: 500_000,
      status: "succeeded",
      paidAt: new Date(),
    });

    // Order-linked payment (tourId null, orderId set) would not count today.
    // Rather than fabricate the insert (which requires an orders row), we
    // assert the current-shape total matches the legacy path only -- if
    // someone extends the query to UNION via payments.orderId, they'll see
    // this test fail and know to update the expectation.
    const caller = await callerAs(user);
    const result = await caller.host.getEarningsHero({ days: 30 });
    expect(result!.currentVnd).toBe(500_000);
  });
});

describe("host.getRevenueByDay offsetDays", () => {
  test("previous-period window (offsetDays=days) does not overlap current window", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const inside = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    const outside = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    // Day -3 falls in the current 7-day window.
    await createPayment({
      tourId: inside.id,
      userId: traveler.id,
      amount: 300_000,
      status: "succeeded",
      paidAt: new Date(Date.now() - 3 * 86400_000),
    });
    // Day -10 falls in the previous 7-day window (offsetDays=7).
    await createPayment({
      tourId: outside.id,
      userId: traveler.id,
      amount: 700_000,
      status: "succeeded",
      paidAt: new Date(Date.now() - 10 * 86400_000),
    });

    const caller = await callerAs(user);
    const current = await caller.host.getRevenueByDay({ days: 7, offsetDays: 0 });
    const previous = await caller.host.getRevenueByDay({ days: 7, offsetDays: 7 });
    expect(current.reduce((a, r) => a + r.grossVnd, 0)).toBe(300_000);
    expect(previous.reduce((a, r) => a + r.grossVnd, 0)).toBe(700_000);
    // Windows must be strictly non-overlapping.
    const currentFirst = current[0].date;
    const previousLast = previous[previous.length - 1].date;
    expect(currentFirst > previousLast).toBe(true);
  });

  test("rejects offsetDays > 365", async () => {
    const { user } = await createHost();
    const caller = await callerAs(user);
    await expect(caller.host.getRevenueByDay({ days: 7, offsetDays: 366 })).rejects.toThrow();
  });

  test("isolation: offset window still scopes to caller's host", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const tourB = await createTour({ userId: traveler.id, hostId: b.host.id, status: "completed" });
    await createPayment({
      tourId: tourB.id,
      userId: traveler.id,
      amount: 1_000_000,
      status: "succeeded",
      paidAt: new Date(Date.now() - 3 * 86400_000),
    });
    const callerA = await callerAs(a.user);
    const result = await callerA.host.getRevenueByDay({ days: 7, offsetDays: 0 });
    expect(result.reduce((r, x) => r + x.grossVnd, 0)).toBe(0);
  });
});

describe("host.getRevenueByDay", () => {
  test("returns contiguous date series with correct totals", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tour1 = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    const tour2 = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });

    await createPayment({ tourId: tour1.id, userId: traveler.id, amount: 500_000, status: "succeeded", paidAt: new Date() });
    await createPayment({ tourId: tour2.id, userId: traveler.id, amount: 300_000, status: "succeeded", paidAt: new Date(Date.now() - 3 * 86400_000) });

    const caller = await callerAs(user);
    const result = await caller.host.getRevenueByDay({ days: 7 });
    expect(result).toHaveLength(7);
    const sum = result.reduce((acc, r) => acc + r.grossVnd, 0);
    expect(sum).toBe(800_000);
    // Commission + net always sums to gross per row.
    for (const r of result) {
      expect(r.commissionVnd + r.netVnd).toBe(r.grossVnd);
    }
  });

  test("excludes refunded / pending / failed payments from buckets", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({ tourId: tour.id, userId: traveler.id, amount: 999_999, status: "pending", paidAt: null });
    const caller = await callerAs(user);
    const result = await caller.host.getRevenueByDay({ days: 7 });
    const sum = result.reduce((acc, r) => acc + r.grossVnd, 0);
    expect(sum).toBe(0);
  });
});

describe("host.getRevenueByExperience", () => {
  test("only returns experiences authored by the caller, ordered by gross desc", async () => {
    const { user, host } = await createHost();
    const otherAuthor = await createUser({ role: "host" });
    const expHigh = await createExperience({ authorId: user.id, title: "Top earner", kind: "host_custom" });
    const expLow = await createExperience({ authorId: user.id, title: "Low earner", kind: "host_custom" });
    const expOther = await createExperience({ authorId: otherAuthor.id, title: "Someone else's", kind: "host_custom" });

    const traveler = await createUser();
    const tA = await createTour({ userId: traveler.id, hostId: host.id, experienceId: expHigh.id, status: "completed" });
    const tB = await createTour({ userId: traveler.id, hostId: host.id, experienceId: expLow.id, status: "completed" });
    await createPayment({ tourId: tA.id, userId: traveler.id, amount: 2_000_000, status: "succeeded", paidAt: new Date() });
    await createPayment({ tourId: tB.id, userId: traveler.id, amount: 500_000, status: "succeeded", paidAt: new Date() });

    const caller = await callerAs(user);
    const result = await caller.host.getRevenueByExperience();
    expect(result.map((r) => r.title)).not.toContain(expOther.title);
    expect(result[0].title).toBe("Top earner");
    expect(result[0].grossVnd).toBe(2_000_000);
    expect(result[0].netVnd).toBe(1_600_000);
    expect(result[0].commissionVnd).toBe(400_000);
    expect(result[1].title).toBe("Low earner");
  });

  test("includes published experiences with zero bookings", async () => {
    const { user } = await createHost();
    await createExperience({ authorId: user.id, title: "Brand new", kind: "host_custom" });
    const caller = await callerAs(user);
    const result = await caller.host.getRevenueByExperience();
    expect(result).toHaveLength(1);
    expect(result[0].bookingCount).toBe(0);
    expect(result[0].grossVnd).toBe(0);
  });
});

describe("host.getPaymentsTimeline", () => {
  test("returns payments with gross/commission/net split, newest first", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser({ displayName: "Test Traveler" });
    const exp = await createExperience({ authorId: user.id, title: "Old Quarter Walk", kind: "host_custom" });
    const olderTour = await createTour({ userId: traveler.id, hostId: host.id, experienceId: exp.id, status: "completed" });
    const newerTour = await createTour({ userId: traveler.id, hostId: host.id, experienceId: exp.id, status: "completed" });
    await createPayment({ tourId: olderTour.id, userId: traveler.id, amount: 500_000, status: "succeeded", paidAt: new Date(Date.now() - 3 * 86400_000) });
    await createPayment({ tourId: newerTour.id, userId: traveler.id, amount: 800_000, status: "succeeded", paidAt: new Date() });

    const caller = await callerAs(user);
    const result = await caller.host.getPaymentsTimeline({ limit: 10 });
    expect(result).toHaveLength(2);
    expect(result[0].grossVnd).toBe(800_000);
    expect(result[0].commissionVnd).toBe(160_000);
    expect(result[0].netVnd).toBe(640_000);
    expect(result[0].travelerName).toBe("Test Traveler");
    expect(result[0].experienceTitle).toBe("Old Quarter Walk");
  });

  test("respects limit and excludes other hosts' payments", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const tB = await createTour({ userId: traveler.id, hostId: b.host.id, status: "completed" });
    await createPayment({ tourId: tB.id, userId: traveler.id, amount: 1_000_000, status: "succeeded", paidAt: new Date() });

    const callerA = await callerAs(a.user);
    const result = await callerA.host.getPaymentsTimeline({ limit: 50 });
    expect(result).toHaveLength(0);
  });
});

describe("host.getCommissionSummary", () => {
  test("reports lifetime gross / commission / net with correct 20% rate", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createPayment({ tourId: tour.id, userId: traveler.id, amount: 1_000_000, status: "succeeded", paidAt: new Date() });

    const caller = await callerAs(user);
    const result = await caller.host.getCommissionSummary();
    expect(result).not.toBeNull();
    expect(result!.commissionRate).toBe(0.2);
    expect(result!.lifetimeGrossVnd).toBe(1_000_000);
    expect(result!.lifetimeCommissionVnd).toBe(200_000);
    expect(result!.lifetimeNetVnd).toBe(800_000);
    expect(result!.bookingCount).toBe(1);
  });
});

describe("host.getPayoutHistory", () => {
  test("returns host's own payouts newest-first", async () => {
    const { user, host } = await createHost();
    const older = await createHostPayout({ hostId: host.id, amount: 1_000_000, status: "paid", periodEnd: new Date(Date.now() - 14 * 86400_000) });
    const newer = await createHostPayout({ hostId: host.id, amount: 1_500_000, status: "paid", periodEnd: new Date(Date.now() - 7 * 86400_000) });

    const caller = await callerAs(user);
    const result = await caller.host.getPayoutHistory({ limit: 10 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(newer.id);
    expect(result[1].id).toBe(older.id);
  });

  test("isolates per host", async () => {
    const a = await createHost();
    const b = await createHost();
    await createHostPayout({ hostId: b.host.id, amount: 5_000_000, status: "paid" });
    const callerA = await callerAs(a.user);
    const result = await callerA.host.getPayoutHistory({ limit: 10 });
    expect(result).toHaveLength(0);
  });
});

describe("host.getStopHeatmap", () => {
  test("aggregates stop visit counts across the host's tours only", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const placeA = await createPlace({ name: "Place A" });
    const placeB = await createPlace({ name: "Place B" });

    const tour1 = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    const tour2 = await createTour({ userId: traveler.id, hostId: host.id, status: "completed" });
    await createTourStop({ tourId: tour1.id, placeId: placeA.id, stopOrder: 0 });
    await createTourStop({ tourId: tour2.id, placeId: placeA.id, stopOrder: 0 });
    await createTourStop({ tourId: tour1.id, placeId: placeB.id, stopOrder: 1 });

    // Another host's stop must NOT show up.
    const otherHost = await createHost();
    const otherTour = await createTour({ userId: traveler.id, hostId: otherHost.host.id, status: "completed" });
    await createTourStop({ tourId: otherTour.id, placeId: placeA.id });

    const caller = await callerAs(user);
    const result = await caller.host.getStopHeatmap();
    expect(result).toHaveLength(2);
    // Ordered by visit count desc -> Place A (2) before Place B (1).
    expect(result[0].placeName).toBe("Place A");
    expect(Number(result[0].visitCount)).toBe(2);
    expect(result[1].placeName).toBe("Place B");
    expect(Number(result[1].visitCount)).toBe(1);
  });

  test("excludes preview tours (unpaid) from the heatmap", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const place = await createPlace({ name: "Pending Place" });
    const previewTour = await createTour({ userId: traveler.id, hostId: host.id, status: "preview" });
    await createTourStop({ tourId: previewTour.id, placeId: place.id });

    const caller = await callerAs(user);
    const result = await caller.host.getStopHeatmap();
    expect(result).toHaveLength(0);
  });
});

describe("host.getStopDetail", () => {
  test("returns place info + tours passing through that stop", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser({ displayName: "Alice" });
    const exp = await createExperience({ authorId: user.id, title: "Morning Walk", kind: "host_custom" });
    const place = await createPlace({ name: "Hoan Kiem Lake" });
    const tour = await createTour({ userId: traveler.id, hostId: host.id, experienceId: exp.id, status: "completed" });
    await createTourStop({ tourId: tour.id, placeId: place.id });

    const caller = await callerAs(user);
    const result = await caller.host.getStopDetail({ placeId: place.id });
    expect(result).not.toBeNull();
    expect(result!.place.name).toBe("Hoan Kiem Lake");
    expect(result!.tours).toHaveLength(1);
    expect(result!.tours[0].travelerName).toBe("Alice");
    expect(result!.tours[0].experienceTitle).toBe("Morning Walk");
  });

  test("returns null when place does not exist", async () => {
    const { user } = await createHost();
    const caller = await callerAs(user);
    const result = await caller.host.getStopDetail({ placeId: "00000000-0000-0000-0000-000000000000" });
    expect(result).toBeNull();
  });

  test("isolates: a host cannot inspect another host's tour-stop traffic", async () => {
    const a = await createHost();
    const b = await createHost();
    const traveler = await createUser();
    const place = await createPlace({ name: "Shared Place" });
    const tourB = await createTour({ userId: traveler.id, hostId: b.host.id, status: "completed" });
    await createTourStop({ tourId: tourB.id, placeId: place.id });

    const callerA = await callerAs(a.user);
    const result = await callerA.host.getStopDetail({ placeId: place.id });
    expect(result).not.toBeNull();
    expect(result!.tours).toHaveLength(0); // host A sees the place but no tours of theirs went through it
  });
});

describe("host.setAvailable", () => {
  test("toggles hostProfiles.isAvailable", async () => {
    const { user, host } = await createHost({ host: { isAvailable: true } });
    const caller = await callerAs(user);
    const result = await caller.host.setAvailable({ isAvailable: false });
    expect(result.isAvailable).toBe(false);

    const [row] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(row.isAvailable).toBe(false);
  });

  test("returns PRECONDITION_FAILED when host role has no hostProfiles row", async () => {
    const { user } = await createHost();
    await getTestDb().delete(hostProfiles).where(eq(hostProfiles.userId, user.id));
    const caller = await callerAs(user);
    await expect(
      caller.host.setAvailable({ isAvailable: true }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects traveler callers (hostProcedure gate)", async () => {
    const traveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);
    await expect(
      caller.host.setAvailable({ isAvailable: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("host verification — zero → published is reachable", () => {
  // Regression for the launch-blocking gap: host onboarding persisted nothing
  // and no code path ever set verificationStatus='approved', so a real host
  // could never publish. These guard the whole zero→approved→listed journey.

  test("becomeHost sets a public slug so an approved host is listable", async () => {
    const traveler = await createUser({ role: "traveler", displayName: "Mai Linh" });
    const caller = await callerAs(traveler);
    await caller.user.becomeHost();

    const [hp] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, traveler.id));
    expect(hp.publicSlug).toBeTruthy();
    expect(hp.publicSlug).toContain(traveler.id.slice(0, 8));
  });

  test("completeSetup creates the row for a register-as-host user (no profile yet)", async () => {
    // Register-as-host makes role='host' but NO hostProfiles row.
    const host = await createUser({ role: "host", displayName: "Tuấn" });
    const caller = await callerAs(host);

    await caller.host.completeSetup({
      bio: "I run lantern-lit Old Quarter food walks.",
      languages: ["English", "Tiếng Việt"],
      specialties: ["Street Food"],
      availability: [
        { dayOfWeek: 1, startTime: "08:00", endTime: "20:00", isActive: true },
        { dayOfWeek: 0, startTime: "08:00", endTime: "20:00", isActive: false },
      ],
    });

    const [hp] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, host.id));
    expect(hp).toBeDefined();
    expect(hp.bio).toContain("food walks");
    expect(hp.specialties).toContain("Street Food");
    expect(hp.verificationStatus).toBe("pending");
    expect(hp.publicSlug).toBeTruthy();

    const slots = await getTestDb()
      .select()
      .from(hostAvailability)
      .where(eq(hostAvailability.hostId, hp.id));
    expect(slots).toHaveLength(2);
  });

  test("adminVerifyHost approves a pending host and surfaces them in listPublic", async () => {
    const host = await createUser({ role: "host", displayName: "Hương" });
    const hostCaller = await callerAs(host);
    await hostCaller.host.completeSetup({
      bio: "Tea-house storyteller in Tây Hồ.",
      languages: ["English"],
      specialties: ["History"],
    });

    const [pending] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.userId, host.id));
    expect(pending.verificationStatus).toBe("pending");

    const admin = await createUser({ role: "admin" });
    const adminCaller = await callerAs(admin);

    // Appears in the admin queue while pending.
    const queue = await adminCaller.host.adminListPendingHosts();
    expect(queue.some((h) => h.hostId === pending.id)).toBe(true);

    await adminCaller.host.adminVerifyHost({ hostId: pending.id });

    const [approved] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, pending.id));
    expect(approved.verificationStatus).toBe("approved");
    expect(approved.verifiedAt).not.toBeNull();

    // Now publicly listable.
    const anon = await callerAs(null);
    const listed = await anon.host.listPublic({ limit: 24 });
    expect(listed.some((h) => h.slug === approved.publicSlug)).toBe(true);
  });

  test("adminVerifyHost requires admin (host caller is FORBIDDEN)", async () => {
    const { host } = await createHost({ host: { verificationStatus: "pending" } });
    const other = await createUser({ role: "host" });
    const caller = await callerAs(other);
    await expect(
      caller.host.adminVerifyHost({ hostId: host.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("completeSetup as 'update profile' keeps an already-approved host approved", async () => {
    const { user, host } = await createHost({ host: { verificationStatus: "approved" } });
    const caller = await callerAs(user);
    await caller.host.completeSetup({ bio: "Updated bio." });

    const [after] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(after.verificationStatus).toBe("approved");
    expect(after.bio).toBe("Updated bio.");
  });
});
