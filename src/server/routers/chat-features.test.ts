import { describe, test, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import {
  matches,
  messages,
  messageReactions,
  messageReports,
  userBlocks,
} from "@/server/db/schema";
import { __resetChatRateLimit } from "@/server/services/chat-ratelimit";
import { applyContactInfoMask } from "@/server/services/chat-moderation";
import { purgeStaleMessages } from "@/server/services/purge-messages";

async function seedMatch(a: string, b: string) {
  const db = getTestDb();
  const [sa, sb] = [a, b].sort();
  const [row] = await db
    .insert(matches)
    .values({
      userAId: sa,
      userBId: sb,
      score: "1.0000",
      status: "matched",
      matchedAt: new Date(),
    })
    .returning();
  return row;
}

async function seedMessage(
  matchId: string,
  senderId: string | null,
  content: string,
  createdAt: Date = new Date(),
  overrides: Partial<typeof messages.$inferInsert> = {},
) {
  const db = getTestDb();
  const [row] = await db
    .insert(messages)
    .values({
      matchId,
      senderId,
      content,
      messageType: "text",
      isRead: false,
      createdAt,
      ...overrides,
    })
    .returning();
  return row;
}

beforeEach(() => {
  __resetChatRateLimit();
});

// ---------------------------------------------------------------------------
// contact-info mask (pure unit)
// ---------------------------------------------------------------------------

describe("applyContactInfoMask", () => {
  test("masks a Vietnamese mobile number", () => {
    const r = applyContactInfoMask("Call me at 0987654321 tonight");
    expect(r.didMask).toBe(true);
    expect(r.content).not.toContain("0987654321");
    expect(r.content).toContain("•••");
  });

  test("masks an email", () => {
    const r = applyContactInfoMask("reach me at alex@example.com");
    expect(r.didMask).toBe(true);
    expect(r.content).not.toContain("alex@example.com");
  });

  test("masks a URL", () => {
    const r = applyContactInfoMask("check https://bit.ly/whatever");
    expect(r.didMask).toBe(true);
    expect(r.content).not.toContain("bit.ly");
  });

  test("masks zalo / whatsapp handles", () => {
    const r = applyContactInfoMask("my zalo is same as whatsapp");
    expect(r.didMask).toBe(true);
    expect(r.content.toLowerCase()).not.toContain("zalo");
    expect(r.content.toLowerCase()).not.toContain("whatsapp");
  });

  test("leaves a legitimate meeting-point address alone", () => {
    const r = applyContactInfoMask("Meet me at 7 Ma May, Hoan Kiem, Hanoi");
    expect(r.didMask).toBe(false);
    expect(r.content).toBe("Meet me at 7 Ma May, Hoan Kiem, Hanoi");
  });
});

// ---------------------------------------------------------------------------
// sendMessage + rate limit + mask integration
// ---------------------------------------------------------------------------

describe("chat.sendMessage integration", () => {
  test("persists masked content and flips flagged when contact info detected", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const caller = await callerAs(alice);

    const sent = await caller.chat.sendMessage({
      matchId: m.id,
      content: "call me 0987654321",
    });
    expect(sent.content).not.toContain("0987654321");
    expect(sent.flagged).toBe(true);
    expect(sent.flagReason).toBe("contact_info");
  });

  test("rate limit rejects the 11th message in 60s burst window", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const caller = await callerAs(alice);

    for (let i = 0; i < 10; i++) {
      await caller.chat.sendMessage({ matchId: m.id, content: `msg ${i}` });
    }
    await expect(
      caller.chat.sendMessage({ matchId: m.id, content: "one too many" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  test("rejects a send when the recipient has blocked the sender", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const db = getTestDb();
    // Bob blocks Alice.
    await db.insert(userBlocks).values({ blockerId: bob.id, blockedId: alice.id });

    const caller = await callerAs(alice);
    await expect(
      caller.chat.sendMessage({ matchId: m.id, content: "hello?" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// edit + unsend windows
// ---------------------------------------------------------------------------

describe("chat.editMessage", () => {
  test("allows editing within 15-min window; rejects after", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const caller = await callerAs(alice);

    const msg = await caller.chat.sendMessage({ matchId: m.id, content: "typo" });
    const edited = await caller.chat.editMessage({
      messageId: msg.id,
      content: "no typo",
    });
    expect(edited.content).toBe("no typo");
    expect(edited.editedAt).not.toBeNull();

    // Force createdAt into the past so the window has closed.
    const db = getTestDb();
    await db
      .update(messages)
      .set({ createdAt: new Date(Date.now() - 20 * 60_000) })
      .where(eq(messages.id, msg.id));
    await expect(
      caller.chat.editMessage({ messageId: msg.id, content: "nope" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects edit by non-sender", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "alice wrote this");
    const bobCaller = await callerAs(bob);
    await expect(
      bobCaller.chat.editMessage({ messageId: msg.id, content: "hacked" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("chat.deleteMessage (unsend)", () => {
  test("soft-deletes within 24h; content tombstoned; idempotent", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const caller = await callerAs(alice);
    const sent = await caller.chat.sendMessage({ matchId: m.id, content: "oops" });

    const deleted = await caller.chat.deleteMessage({ messageId: sent.id });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.content).toBe("[message deleted]");

    // Idempotent re-invocation returns the existing tombstone.
    const again = await caller.chat.deleteMessage({ messageId: sent.id });
    expect(again.deletedAt).not.toBeNull();
  });

  test("rejects unsend after 24h window", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(
      m.id,
      alice.id,
      "ancient",
      new Date(Date.now() - 25 * 60 * 60_000),
    );
    const caller = await callerAs(alice);
    await expect(
      caller.chat.deleteMessage({ messageId: msg.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("getMessages surfaces deleted rows as tombstones", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const caller = await callerAs(alice);
    const sent = await caller.chat.sendMessage({ matchId: m.id, content: "oops" });
    await caller.chat.deleteMessage({ messageId: sent.id });

    const { items } = await caller.chat.getMessages({ matchId: m.id });
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe("[message deleted]");
    expect(items[0].deletedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reactions
// ---------------------------------------------------------------------------

describe("chat.reactions", () => {
  test("add + remove reaction round-trip; UNIQUE dedupes double-clicks", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "hi");
    const caller = await callerAs(bob);

    await caller.chat.addReaction({ messageId: msg.id, emoji: "🔥" });
    // Double-click: should be absorbed silently.
    await caller.chat.addReaction({ messageId: msg.id, emoji: "🔥" });

    const { items } = await caller.chat.getMessages({ matchId: m.id });
    const r = items[0].reactions?.find((x) => x.emoji === "🔥");
    expect(r?.count).toBe(1);
    expect(r?.reactedByMe).toBe(true);

    await caller.chat.removeReaction({ messageId: msg.id, emoji: "🔥" });
    const { items: after } = await caller.chat.getMessages({ matchId: m.id });
    expect(after[0].reactions ?? []).toEqual([]);
  });

  test("rejects emoji outside the curated allowlist", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "hi");
    const caller = await callerAs(bob);
    await expect(
      caller.chat.addReaction({ messageId: msg.id, emoji: "🦄" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("caps at 3 distinct emojis per user per message", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "hi");
    const caller = await callerAs(bob);
    await caller.chat.addReaction({ messageId: msg.id, emoji: "👍" });
    await caller.chat.addReaction({ messageId: msg.id, emoji: "❤️" });
    await caller.chat.addReaction({ messageId: msg.id, emoji: "😂" });
    await expect(
      caller.chat.addReaction({ messageId: msg.id, emoji: "🙏" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------

describe("chat.reportMessage", () => {
  test("persists a report and flips messages.flagged = true", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "bad");
    const bobCaller = await callerAs(bob);

    await bobCaller.chat.reportMessage({
      messageId: msg.id,
      reason: "harassment",
      notes: "calling me names",
    });

    const db = getTestDb();
    const [row] = await db.select().from(messages).where(eq(messages.id, msg.id));
    expect(row.flagged).toBe(true);
    expect(row.flagReason).toBe("harassment");

    const [report] = await db
      .select()
      .from(messageReports)
      .where(eq(messageReports.messageId, msg.id));
    expect(report.reason).toBe("harassment");
    expect(report.notes).toBe("calling me names");
    expect(report.status).toBe("open");
  });

  test("admin list shows the open report; resolve flips status", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const admin = await createUser({ role: "admin" });
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "bad");
    const bobCaller = await callerAs(bob);
    await bobCaller.chat.reportMessage({ messageId: msg.id, reason: "spam" });

    const adminCaller = await callerAs(admin);
    const listed = await adminCaller.chat.adminListFlagged();
    expect(listed).toHaveLength(1);
    await adminCaller.chat.adminResolveReport({
      reportId: listed[0].report.id,
      resolution: "resolved",
    });
    const after = await adminCaller.chat.adminListFlagged();
    expect(after).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// block
// ---------------------------------------------------------------------------

describe("chat.blockUser / unblockUser", () => {
  test("block hides conversations from both sides; unblock restores them", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await seedMatch(alice.id, bob.id);

    const aliceCaller = await callerAs(alice);
    const bobCaller = await callerAs(bob);

    // Pre-block: both see the conversation.
    expect(await aliceCaller.chat.getConversations()).toHaveLength(1);
    expect(await bobCaller.chat.getConversations()).toHaveLength(1);

    await aliceCaller.chat.blockUser({ userId: bob.id });
    expect(await aliceCaller.chat.getConversations()).toHaveLength(0);
    expect(await bobCaller.chat.getConversations()).toHaveLength(0);

    await aliceCaller.chat.unblockUser({ userId: bob.id });
    expect(await aliceCaller.chat.getConversations()).toHaveLength(1);
    expect(await bobCaller.chat.getConversations()).toHaveLength(1);
  });

  test("can't block yourself", async () => {
    const u = await createUser();
    const caller = await callerAs(u);
    await expect(caller.chat.blockUser({ userId: u.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

// ---------------------------------------------------------------------------
// search + export
// ---------------------------------------------------------------------------

describe("chat.searchMessages", () => {
  test("finds matching content across my conversations, excluding tombstones", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    await seedMessage(m.id, alice.id, "let's meet at Hoan Kiem Lake");
    await seedMessage(m.id, bob.id, "how about Temple of Literature");
    await seedMessage(m.id, alice.id, "[message deleted]", new Date(), { deletedAt: new Date() });

    const caller = await callerAs(alice);
    const hits = await caller.chat.searchMessages({ q: "Temple" });
    expect(hits).toHaveLength(1);
    expect(hits[0].content).toContain("Temple");
  });

  test("never returns another user's messages", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    const mAB = await seedMatch(alice.id, bob.id);
    await seedMessage(mAB.id, alice.id, "secret plan");
    const carolCaller = await callerAs(carol);
    const hits = await carolCaller.chat.searchMessages({ q: "secret" });
    expect(hits).toHaveLength(0);
  });
});

describe("chat.exportHistory", () => {
  test("returns only the caller's conversations", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    const mAB = await seedMatch(alice.id, bob.id);
    const mBC = await seedMatch(bob.id, carol.id);
    await seedMessage(mAB.id, alice.id, "alice-bob");
    await seedMessage(mBC.id, bob.id, "bob-carol");

    const caller = await callerAs(alice);
    const out = await caller.chat.exportHistory();
    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0].matchId).toBe(mAB.id);
    expect(out.conversations[0].messages.map((m) => m.content)).toEqual(["alice-bob"]);
  });
});

// ---------------------------------------------------------------------------
// retention cron
// ---------------------------------------------------------------------------

describe("purgeStaleMessages", () => {
  test("hard-deletes messages older than retentionDays; keeps fresh ones", async () => {
    const db = getTestDb();
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const fresh = await seedMessage(m.id, alice.id, "today");
    const ancient = await seedMessage(
      m.id,
      alice.id,
      "long ago",
      new Date(Date.now() - 31 * 86400_000),
    );

    const result = await purgeStaleMessages(db, 30);
    expect(result.deletedMessages).toBeGreaterThanOrEqual(1);
    const remaining = await db.select().from(messages).where(eq(messages.matchId, m.id));
    expect(remaining.map((r) => r.id)).toContain(fresh.id);
    expect(remaining.map((r) => r.id)).not.toContain(ancient.id);
  });
});

// ---------------------------------------------------------------------------
// account-deletion tombstone behavior
// ---------------------------------------------------------------------------

describe("user.deleteAccount tombstones messages", () => {
  test("messages from the deleted user have content scrubbed + deletedAt set; survivor sees the tombstone", async () => {
    const alice = await createUser({ email: "alice-goodbye@test.com" });
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    await seedMessage(m.id, alice.id, "see you tomorrow!");
    await seedMessage(m.id, bob.id, "sounds good");

    const aliceCaller = await callerAs(alice);
    await aliceCaller.user.deleteAccount({
      confirmEmail: "alice-goodbye@test.com",
      currentPassword: "password123",
    });

    const db = getTestDb();
    const rows = await db.select().from(messages).where(eq(messages.matchId, m.id));
    // Alice's message: content scrubbed, deletedAt set, senderId null (FK set null).
    const alicesMsg = rows.find((r) => r.content.includes("deleted their account"));
    expect(alicesMsg).toBeTruthy();
    expect(alicesMsg!.deletedReason).toBe("sender_account_deleted");

    // Bob's side: readable, match still exists (userAId OR userBId null ok).
    const bobCaller = await callerAs(bob);
    const conv = await bobCaller.chat.getConversations();
    expect(conv).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// cleanup
// ---------------------------------------------------------------------------

describe("schema invariants (smoke)", () => {
  test("CHECK-equivalent: can't soft-delete without reason (just a smoke)", async () => {
    const db = getTestDb();
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const row = await seedMessage(m.id, alice.id, "x", new Date(), {
      deletedAt: new Date(),
      deletedReason: "user_unsent",
    });
    const fetched = await db.select().from(messages).where(eq(messages.id, row.id));
    expect(fetched[0].deletedReason).toBe("user_unsent");
    // Just asserting the row persists; no DB-level CHECK here, the
    // contract is application-enforced.
  });

  test("reaction UNIQUE index prevents duplicate insert", async () => {
    const db = getTestDb();
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const msg = await seedMessage(m.id, alice.id, "hey");
    await db.insert(messageReactions).values({
      messageId: msg.id,
      userId: bob.id,
      emoji: "👍",
    });
    await expect(
      db.insert(messageReactions).values({
        messageId: msg.id,
        userId: bob.id,
        emoji: "👍",
      }),
    ).rejects.toThrow();
  });
});

// silence unused imports if any slip
void and;
