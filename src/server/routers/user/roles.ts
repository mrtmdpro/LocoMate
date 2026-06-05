import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { users, userProfiles, hostProfiles, tours, experiences } from "../../db/schema";

export const userRoleProcedures = {
  /**
   * Promotes a traveler to host. Called from the onboarding "I'm a host"
   * option so OAuth signups (forced to `role='traveler'` by the OAuth
   * callback) + anyone who picked "Traveler" at register can switch paths
   * without creating a duplicate account. Idempotent: calling when the user
   * is already a host is a no-op that returns the existing host profile.
   *
   * Admin is treated as strictly more-privileged than host; we never demote
   * admin through this path.
   */
  becomeHost: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "host" && ctx.user.role !== "admin") {
      await ctx.db
        .update(users)
        .set({ role: "host", updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id));
    }

    // Mark traveler onboarding complete: hosts complete host-setup + ID
    // verification instead of the intent/interests flow. Without this flip,
    // logging out and back in would bounce them to /onboarding because the
    // login handler checks user_profiles.onboardingCompleted.
    await ctx.db
      .update(userProfiles)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(userProfiles.userId, ctx.user.id));

    // Ensure the host has a hostProfiles row. Status stays 'pending' so the
    // hostExperience.publish verification gate still applies until an admin
    // approves (or ID verification auto-approves later).
    const existing = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!existing) {
      await ctx.db.insert(hostProfiles).values({
        userId: ctx.user.id,
        bio: null,
        languages: [],
        specialties: [],
        verificationStatus: "pending",
      });
    }

    return { role: "host" as const };
  }),

  /**
   * Reverse of `becomeHost`: demotes a host back to traveler so they can
   * browse Hà Nội as a guest. Triggered from Settings → Account.
   *
   * Symmetry with becomeHost:
   *  - Admins are never demoted (no-op return).
   *  - Travelers calling this is an idempotent no-op.
   *  - The `host_profiles` row is preserved (only `isAvailable` flips to
   *    false). A future `becomeHost` re-toggle keeps the row's
   *    `verificationStatus`, `publicSlug`, `bio`, etc. so the user does not
   *    have to redo ID verification.
   *
   * Guard: if the host has any tour with `status IN ('paid','active')` we
   * refuse with PRECONDITION_FAILED so paying travelers don't get
   * abandoned mid-booking. Live tours must be completed or cancelled
   * through the existing host flow before this mutation succeeds.
   *
   * Side effects on success:
   *  - `users.role` becomes `traveler`.
   *  - `host_profiles.isAvailable` becomes `false` (hides the host from
   *    matching + `/hosts`).
   *  - Any `experiences` rows authored by this user with `status = 'published'`
   *    are flipped to `'draft'` so they stop being bookable. On re-toggle
   *    the user re-publishes manually.
   */
  becomeTraveler: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return { role: "admin" as const, listingsUnpublished: 0 };
    }
    if (ctx.user.role === "traveler") {
      return { role: "traveler" as const, listingsUnpublished: 0 };
    }

    const hostProfile = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });

    // Guard against orphaned hosts (role=host without a host_profiles row).
    // We still let the role flip so the user is not stuck, but skip the
    // host-side cleanup that depends on a host id.
    if (hostProfile) {
      const liveTours = await ctx.db
        .select({ id: tours.id })
        .from(tours)
        .where(
          and(
            eq(tours.hostId, hostProfile.id),
            inArray(tours.status, ["paid", "active"]),
          ),
        );

      if (liveTours.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `You have ${liveTours.length} upcoming or active tour${liveTours.length === 1 ? "" : "s"}. Please complete or cancel them before switching.`,
        });
      }
    }

    const listingsUnpublished = await ctx.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ role: "traveler", updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id));

      if (hostProfile) {
        await tx
          .update(hostProfiles)
          .set({ isAvailable: false, updatedAt: new Date() })
          .where(eq(hostProfiles.id, hostProfile.id));
      }

      const drafted = await tx
        .update(experiences)
        .set({ status: "draft" })
        .where(
          and(
            eq(experiences.authorId, ctx.user.id),
            eq(experiences.status, "published"),
          ),
        )
        .returning({ id: experiences.id });

      return drafted.length;
    });

    return { role: "traveler" as const, listingsUnpublished };
  }),
} satisfies TRPCRouterRecord;
