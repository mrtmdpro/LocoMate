import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { adminProcedure } from "../../trpc";
import { messages, messageReports, users } from "../../db/schema";
import { purgeStaleMessages } from "@/server/services/purge-messages";

export const chatAdminProcedures = {
  adminListFlagged: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          report: messageReports,
          message: messages,
          sender: {
            id: users.id,
            displayName: users.displayName,
            email: users.email,
          },
        })
        .from(messageReports)
        .innerJoin(messages, eq(messageReports.messageId, messages.id))
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messageReports.status, "open"))
        .orderBy(desc(messageReports.createdAt))
        .limit(input.limit);
    }),

  adminResolveReport: adminProcedure
    .input(
      z.object({
        reportId: z.string().uuid(),
        resolution: z.enum(["resolved", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(messageReports)
        .set({
          status: input.resolution,
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(messageReports.id, input.reportId));
      return { success: true };
    }),

  adminPurgeStale: adminProcedure
    .input(z.object({ retentionDays: z.number().int().min(1).max(365).default(30) }).default({ retentionDays: 30 }))
    .mutation(async ({ ctx, input }) => {
      return purgeStaleMessages(ctx.db, input.retentionDays);
    }),
} satisfies TRPCRouterRecord;
