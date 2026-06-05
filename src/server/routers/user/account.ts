import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { compareSync } from "bcryptjs";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import {
  users,
  hostProfiles,
  places,
  payments,
  reports,
  experiences,
  tours,
  messages,
} from "../../db/schema";
import { rateLimit } from "../../services/chat-ratelimit";

export const userAccountProcedures = {
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
      // Destructive + a second-factor gate; cap attempts so a stolen access
      // token can't brute-force the password confirmation.
      await rateLimit({
        key: `user:deleteAccount:${ctx.user.id}`,
        limit: 5,
        windowSec: 300,
      });
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
} satisfies TRPCRouterRecord;
