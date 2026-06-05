import { eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { messages, matches, userBlocks } from "../../db/schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Seconds during which a sender may still edit their own message. Keep
 * short to match the Airbnb / Messenger "oops, typo" use case without
 * letting senders rewrite history after the recipient replied.
 */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Seconds during which a sender may unsend (soft-delete) their message.
 * Longer than EDIT_WINDOW because "I sent this to the wrong thread" is
 * a realer mistake than a typo, and the recipient might not yet have
 * opened the chat.
 */
export const UNSEND_WINDOW_MS = 24 * 60 * 60 * 1000;

export const MAX_REACTIONS_PER_USER_PER_MESSAGE = 3;

// Curated emoji set surfaced by the UI picker. Kept small to avoid a
// full emoji library and to keep reaction grouping readable.
export const ALLOWED_REACTION_EMOJIS = new Set([
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
  "✅",
  "🔥",
  "👏",
  "😀",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function verifyMatchParticipant(
  db: typeof import("../../db").db,
  matchId: string,
  userId: string,
) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
  // userAId / userBId are now nullable (account deletion sets them NULL).
  // A caller is still a participant iff they equal one of the non-null sides.
  if (match.userAId !== userId && match.userBId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
  }
  if (match.status !== "matched") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conversation not available" });
  }
  return match;
}

/**
 * Apply the caller's block list as a filter. Returns the list of user IDs
 * the caller has either blocked or been blocked by -- matches involving
 * any of these counterparties should be hidden. One round-trip, one `OR`.
 */
export async function getBlockedCounterpartyIds(
  db: typeof import("../../db").db,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ a: userBlocks.blockerId, b: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
  const out = new Set<string>();
  for (const r of rows) {
    if (r.a !== userId) out.add(r.a);
    if (r.b !== userId) out.add(r.b);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Utility: shape a raw message row for the client. Soft-deleted rows get
// their content/attachment scrubbed to make the tombstone render obvious.
// ---------------------------------------------------------------------------

export function sanitizeMessageForClient(row: typeof messages.$inferSelect) {
  if (row.deletedAt) {
    return {
      ...row,
      content: "[message deleted]",
      attachmentUrl: null,
      attachmentKind: null,
    };
  }
  return row;
}

/**
 * Detect a Postgres "unique violation" across both the postgres-js
 * driver (production) and PGlite (tests). postgres-js surfaces code
 * '23505' on the error object; PGlite sometimes wraps it under a
 * different shape. Matching on both covers us either way.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  if (e.code === "23505") return true;
  if (e.cause?.code === "23505") return true;
  const msg = e.message ?? e.cause?.message ?? "";
  return /unique|duplicate/i.test(msg);
}
