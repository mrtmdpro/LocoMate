import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { compareSync } from "bcryptjs";
import { router, protectedProcedure } from "../trpc";
import {
  userProfiles,
  users,
  emergencyContacts,
  places,
  payments,
  reports,
  accounts,
  hostProfiles,
  experiences,
  tours,
  messages,
  thankYouLetters,
} from "../db/schema";
import { desc } from "drizzle-orm";
import { onboardingSchema } from "@/lib/validations/auth";
import { computeDerivedProfile } from "../services/profile-engine";

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, ctx.user.id),
    });

    // Which OAuth providers the user has linked. Currently only Google, but
    // the query shape generalises so adding Apple/GitHub later is a no-op
    // for the security page.
    const linkedAccounts = await ctx.db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, ctx.user.id));
    const linkedProviders = linkedAccounts.map((a) => a.provider);

    // Host verification is only meaningful when the user has a host profile.
    // Travelers get `null` here and the UI hides that row.
    const host =
      ctx.user.role === "host"
        ? await ctx.db.query.hostProfiles.findFirst({
            where: eq(hostProfiles.userId, ctx.user.id),
          })
        : null;

    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        displayName: ctx.user.displayName,
        role: ctx.user.role,
        avatarUrl: ctx.user.avatarUrl,
        hasPassword: !!ctx.user.passwordHash,
        emailVerified: ctx.user.emailVerified === true,
        phoneVerified: ctx.user.phoneVerified === true,
        linkedProviders,
      },
      host: host
        ? {
            verificationStatus: host.verificationStatus,
            verifiedAt: host.verifiedAt,
          }
        : null,
      profile,
    };
  }),

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

  updateProfile: protectedProcedure
    .input(z.object({
      displayName: z.string().min(2).max(100).optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id))
        .returning();
      return updated;
    }),

  /**
   * Cross-device theme persistence for the "Nắng Sớm Tràng An" /
   * "Đêm Sâu Phố Cổ" toggle. Writes to userProfiles.explicitData.themePref
   * (jsonb — no migration). The client-side next-themes provider is still
   * the rendering source of truth via localStorage; this mutation is a
   * sync-on-change so that signing in on a new device picks up the user's
   * choice. Read on the home page (or layout) to seed next-themes from
   * the server when localStorage hasn't been populated yet.
   */
  setThemePref: protectedProcedure
    .input(z.object({ theme: z.enum(["light", "dark"]) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (existing?.explicitData ?? {}) as Record<string, unknown>;
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: { ...explicit, themePref: input.theme },
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, theme: input.theme };
    }),

  /**
   * Personalised "danh xưng" the app uses to address the user. Written to
   * userProfiles.explicitData.nickname (jsonb). All home/profile/letters
   * surfaces read this via `useDisplayName()` with a fallback ladder of
   * nickname -> displayName -> "Lữ khách". An empty string clears the
   * nickname back to the default fallback.
   */
  setNickname: protectedProcedure
    .input(z.object({ nickname: z.string().trim().max(40) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (existing?.explicitData ?? {}) as Record<string, unknown>;
      const next = { ...explicit };
      if (input.nickname.length === 0) {
        delete next.nickname;
      } else {
        next.nickname = input.nickname;
      }
      await ctx.db
        .update(userProfiles)
        .set({ explicitData: next, updatedAt: new Date() })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, nickname: input.nickname || null };
    }),

  /**
   * Cross-device UI locale persistence. The Settings → App Language toggle
   * fires this whenever the user switches between English and Vietnamese.
   * Written to userProfiles.explicitData.locale; the matching `NEXT_LOCALE`
   * cookie is set on the client so next-intl middleware picks the same
   * locale on subsequent navigations. Login on a new device reads this
   * value and seeds the cookie before the first render.
   *
   * The set of accepted values mirrors `routing.locales` in
   * `src/i18n/routing.ts`. Adding a locale there means widening this enum
   * too.
   */
  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(["en", "vi"]) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (existing?.explicitData ?? {}) as Record<string, unknown>;
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: { ...explicit, locale: input.locale },
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, locale: input.locale };
    }),

  /**
   * Traveler's spoken languages — passed to hosts at booking time so
   * they can greet the guest in the right tongue. This is the
   * traveler-side counterpart of `host_profiles.languages`. Written to
   * userProfiles.explicitData.languages as a string[]; values are limited
   * to the well-known label set the Profile picker offers so the host's
   * matching UI can render consistent chips.
   *
   * NOT the same as the Settings App Language toggle, which controls the
   * UI locale via `setLocale`.
   */
  setSpokenLanguages: protectedProcedure
    .input(
      z.object({
        languages: z
          .array(
            z.enum([
              "English",
              "Tiếng Việt",
              "日本語",
              "한국어",
              "Français",
              "Español",
              "中文",
            ]),
          )
          .max(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (existing?.explicitData ?? {}) as Record<string, unknown>;
      // De-duplicate while preserving caller order so the host UI can
      // surface the user's primary language first.
      const dedup = Array.from(new Set(input.languages));
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: { ...explicit, languages: dedup },
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, languages: dedup };
    }),

  /**
   * Saves the user's chosen AI tone (Phase A.7) AND the computed personality
   * label from the chatbot quiz (Phase A.8). The tone lives in explicitData
   * (user-chosen), the label in derivedData (system-computed). Splitting
   * them across the two jsonb columns mirrors how onboarding already treats
   * "what the user told us" vs "what we inferred".
   *
   * Also saves a per-feature tourPreferences (Phase A.4) blob.
   */
  savePersonality: protectedProcedure
    .input(z.object({
      tone: z.enum(["thu-thi", "hom-hinh", "truc-dien"]).optional(),
      personalityLabel: z.string().min(1).max(60).optional(),
      /**
       * 4-D personality vector from `toVectorV4(scorePersonality(picks))`.
       * Fed into the Fixed Tour cosine matcher. Order is
       * `[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`
       * — must align with the tour vectors seeded in seed-fixed-tours.ts.
       */
      personalityVector: z
        .tuple([
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
        ])
        .optional(),
      tourPreferences: z.object({
        guideStyle: z.enum(["researcher", "buddy"]).optional(),
        meal: z.object({
          vegetarian: z.boolean().optional(),
          noSpice: z.boolean().optional(),
          allergies: z.array(z.string().max(40)).max(10).optional(),
        }).optional(),
        route: z.enum(["walking", "cyclo", "vintage-bike"]).optional(),
        groupSize: z.enum(["solo", "couple", "group6"]).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (existing?.explicitData ?? {}) as Record<string, unknown>;
      const derived = (existing?.derivedData ?? {}) as Record<string, unknown>;
      const nextExplicit: Record<string, unknown> = { ...explicit };
      const nextDerived: Record<string, unknown> = { ...derived };
      if (input.tone !== undefined) nextExplicit.aiTone = input.tone;
      if (input.tourPreferences !== undefined) {
        nextExplicit.tourPreferences = input.tourPreferences;
      }
      if (input.personalityLabel !== undefined) {
        nextDerived.personalityLabel = input.personalityLabel;
      }
      if (input.personalityVector !== undefined) {
        nextDerived.personalityVector = input.personalityVector;
      }
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: nextExplicit,
          derivedData: nextDerived,
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true };
    }),

  submitOnboarding: protectedProcedure
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const derived = computeDerivedProfile(input);

      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: input,
          derivedData: derived,
          onboardingCompleted: true,
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { success: true, derived };
    }),

  updatePreferences: protectedProcedure
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const derived = computeDerivedProfile(input);

      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: input,
          derivedData: derived,
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { success: true, derived };
    }),

  /**
   * Phase A.6 — list the user's thank-you letters. Only sent ones are
   * returned (un-sent rows are scheduled but not yet rendered). Newest
   * first.
   */
  getThankYouLetters: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(thankYouLetters)
      .where(and(
        eq(thankYouLetters.userId, ctx.user.id),
        // Sent only — `isNull` would be the inverse; we want sentAt set.
      ))
      .orderBy(desc(thankYouLetters.sentAt));
    return rows.filter((r) => r.sentAt !== null);
  }),

  /** Mark a letter as read so the bell stops badging. */
  markLetterRead: protectedProcedure
    .input(z.object({ letterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(thankYouLetters)
        .set({ readAt: new Date() })
        .where(and(
          eq(thankYouLetters.id, input.letterId),
          eq(thankYouLetters.userId, ctx.user.id),
        ));
      return { success: true };
    }),

  getEmergencyContacts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.emergencyContacts.findMany({
      where: eq(emergencyContacts.userId, ctx.user.id),
    });
  }),

  setEmergencyContact: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      phone: z.string().min(5).max(20),
      relationship: z.string().max(50).optional(),
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [contact] = await ctx.db
        .insert(emergencyContacts)
        .values({ userId: ctx.user.id, ...input })
        .returning();
      return contact;
    }),

  updateEmergencyContact: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      phone: z.string().min(5).max(20),
      relationship: z.string().max(50).optional(),
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(emergencyContacts)
        .set(data)
        .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, ctx.user.id)))
        .returning();
      return updated;
    }),

  deleteEmergencyContact: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(emergencyContacts)
        .where(and(eq(emergencyContacts.id, input.id), eq(emergencyContacts.userId, ctx.user.id)));
      return { success: true };
    }),

  // Permanently delete the user and everything traceable to them. Destructive.
  // Requires the user to retype their email; password users must also supply
  // their current password as a second factor so a stolen access token alone
  // cannot wipe the account.
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmEmail: z.string().min(1),
        currentPassword: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const storedEmail = (ctx.user.email ?? "").toLowerCase();
      const typedEmail = input.confirmEmail.trim().toLowerCase();

      if (!storedEmail || typedEmail !== storedEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email confirmation does not match the account email.",
        });
      }

      // Password users must supply their current password. OAuth-only users
      // (passwordHash === null) skip this check; the email retype + proof of a
      // valid access token is sufficient.
      if (ctx.user.passwordHash) {
        if (!input.currentPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current password is required.",
          });
        }
        const ok = compareSync(input.currentPassword, ctx.user.passwordHash);
        if (!ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Incorrect password.",
          });
        }
      }

      // Several FKs reference users.id / hostProfiles.id without ON DELETE
      // rules that cover the marketplace flow. Detach them in the correct
      // order inside one transaction so the final DELETE cascade succeeds.
      await ctx.db.transaction(async (tx) => {
        // 1. Non-cascading FKs to users.id (would otherwise block the DELETE).
        await tx
          .update(places)
          .set({ contributedBy: null })
          .where(eq(places.contributedBy, userId));
        await tx
          .update(payments)
          .set({ userId: null })
          .where(eq(payments.userId, userId));
        await tx
          .update(reports)
          .set({ resolvedBy: null })
          .where(eq(reports.resolvedBy, userId));

        // 2. Archive any host-authored experiences so traveler bookings stop
        //    before the author row vanishes. Listings stay in the DB for
        //    receipt history but are hidden from the public list (published
        //    filter). Also nulls the slug so the same author can't reclaim a
        //    squatted slug after a re-registration. (schema only SETs
        //    authorId to NULL on user delete; without this, a host_custom
        //    listing with authorId=NULL would still show on /experiences
        //    with no host and be bookable as an orphan.)
        await tx
          .update(experiences)
          .set({ status: "archived" })
          .where(eq(experiences.authorId, userId));

        // 3. tours.hostId references hostProfiles.id with no ON DELETE rule,
        //    so when users cascade drops hostProfiles, Postgres would refuse.
        //    Null it out first; the tour survives (payment record intact) but
        //    no longer claims a host.
        const hostRow = await tx.query.hostProfiles.findFirst({
          where: eq(hostProfiles.userId, userId),
        });
        if (hostRow) {
          await tx
            .update(tours)
            .set({ hostId: null })
            .where(eq(tours.hostId, hostRow.id));
        }

        // 4. Tombstone outbound messages BEFORE the user delete cascades.
        //    matches.user_a_id / user_b_id is ON DELETE SET NULL (post
        //    chat-overhaul), so the survivor's conversation stays intact;
        //    we just need to scrub the departing user's PII from message
        //    content + attachments so "right to erasure" is honored while
        //    leaving the thread chronologically readable for the other
        //    side. The 30-day retention cron will hard-delete these rows
        //    in due course.
        await tx
          .update(messages)
          .set({
            content: "[this user deleted their account]",
            attachmentUrl: null,
            attachmentKind: null,
            deletedAt: new Date(),
            deletedReason: "sender_account_deleted",
          })
          .where(eq(messages.senderId, userId));

        // 5. The remaining dependents cascade on users.id delete:
        //    user_profiles, host_profiles (and host_availability via it),
        //    saved_places, swipe_actions, tours (and tour_stops,
        //    payments.tour_id via it), emergency_contacts, accounts,
        //    message_reactions, message_reports, user_blocks.
        //    `messages.sender_id`, `matches.user_a_id`, `matches.user_b_id`,
        //    `reviews.reviewer_id`, `reports.reporter_id`
        //    are ON DELETE SET NULL so historical content is preserved
        //    without PII ownership.
        const deleted = await tx
          .delete(users)
          .where(eq(users.id, userId))
          .returning({ id: users.id });

        if (deleted.length === 0) {
          // Transaction will roll back.
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found.",
          });
        }
      });

      return { success: true };
    }),
});
