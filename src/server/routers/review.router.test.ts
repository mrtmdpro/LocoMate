import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser, createHost, createTour } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { hostProfiles } from "@/server/db/schema";

describe("review.submitTourReview", () => {
  test("records a tour review with rating, comment and photos", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "completed" });
    const caller = await callerAs(user);

    const review = await caller.review.submitTourReview({
      tourId: tour.id,
      rating: 5,
      comment: "Wonderful day.",
      photos: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });
    expect(review.rating).toBe(5);
    expect(review.photos).toHaveLength(2);
  });

  test("recomputes the host's avgRating + totalReviews from tour reviews", async () => {
    // Fixture host starts at the stale default 4.80 / 10 reviews; the recompute
    // must overwrite it with the real aggregate (nothing wrote it before).
    const { host } = await createHost();
    const user = await createUser();
    const tour = await createTour({ userId: user.id, hostId: host.id, status: "completed" });
    const caller = await callerAs(user);

    await caller.review.submitTourReview({ tourId: tour.id, rating: 4 });

    const [after] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(Number(after.avgRating)).toBe(4);
    expect(after.totalReviews).toBe(1);
  });

  test("averages across multiple tours of the same host", async () => {
    const { host } = await createHost();
    const a = await createUser();
    const b = await createUser();
    const tourA = await createTour({ userId: a.id, hostId: host.id, status: "completed" });
    const tourB = await createTour({ userId: b.id, hostId: host.id, status: "completed" });

    await (await callerAs(a)).review.submitTourReview({ tourId: tourA.id, rating: 5 });
    await (await callerAs(b)).review.submitTourReview({ tourId: tourB.id, rating: 2 });

    const [after] = await getTestDb()
      .select()
      .from(hostProfiles)
      .where(eq(hostProfiles.id, host.id));
    expect(Number(after.avgRating)).toBe(3.5);
    expect(after.totalReviews).toBe(2);
  });

  test("a tour with no host leaves host aggregates untouched", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "completed" }); // no hostId
    const caller = await callerAs(user);
    // Should not throw despite there being no host to recompute.
    const review = await caller.review.submitTourReview({ tourId: tour.id, rating: 5 });
    expect(review.id).toBeTruthy();
  });

  test("rejects a second review on the same tour by the same user (CONFLICT)", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "completed" });
    const caller = await callerAs(user);
    await caller.review.submitTourReview({ tourId: tour.id, rating: 4 });
    await expect(
      caller.review.submitTourReview({ tourId: tour.id, rating: 3 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("rejects reviewing a tour you don't own", async () => {
    const owner = await createUser();
    const other = await createUser();
    const tour = await createTour({ userId: owner.id, status: "completed" });
    const caller = await callerAs(other);
    await expect(
      caller.review.submitTourReview({ tourId: tour.id, rating: 5 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects more than 3 photos", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "completed" });
    const caller = await callerAs(user);
    await expect(
      caller.review.submitTourReview({
        tourId: tour.id,
        rating: 5,
        photos: ["a", "b", "c", "d"].map((s) => `https://example.com/${s}.jpg`),
      }),
    ).rejects.toThrow();
  });
});
