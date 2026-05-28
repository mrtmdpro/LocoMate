import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { matches, messages } from "@/server/db/schema";

async function seedMatch(userAId: string, userBId: string) {
  const db = getTestDb();
  const [sortedA, sortedB] = [userAId, userBId].sort();
  const [row] = await db
    .insert(matches)
    .values({
      userAId: sortedA,
      userBId: sortedB,
      score: "1.0000",
      status: "matched",
      matchedAt: new Date(),
    })
    .returning();
  return row;
}

async function seedMessage(
  matchId: string,
  senderId: string,
  content: string,
  createdAt: Date,
  isRead = false,
) {
  const db = getTestDb();
  const [row] = await db
    .insert(messages)
    .values({ matchId, senderId, content, messageType: "text", isRead, createdAt })
    .returning();
  return row;
}

describe("chat.getConversations", () => {
  test("returns conversations hydrated with otherUser, lastMessage, and unreadCount", async () => {
    const alice = await createUser({ displayName: "Alice" });
    const bob = await createUser({ displayName: "Bob" });
    const m = await seedMatch(alice.id, bob.id);

    const t0 = new Date(Date.now() - 3 * 60_000);
    const t1 = new Date(Date.now() - 2 * 60_000);
    const t2 = new Date(Date.now() - 1 * 60_000);
    await seedMessage(m.id, alice.id, "Hi", t0, true);
    await seedMessage(m.id, bob.id, "Hey", t1, false);
    await seedMessage(m.id, bob.id, "How are you?", t2, false);

    const caller = await callerAs(alice);
    const result = await caller.chat.getConversations();
    expect(result).toHaveLength(1);
    const conv = result[0];
    expect(conv.otherUser?.id).toBe(bob.id);
    expect(conv.otherUser?.displayName).toBe("Bob");
    expect(conv.lastMessage?.content).toBe("How are you?");
    // Two incoming messages from Bob, both unread.
    expect(conv.unreadCount).toBe(2);
  });

  test("does not leak private fields (passwordHash, email, phone) on otherUser", async () => {
    const alice = await createUser({ email: "alice@test.com" });
    const bob = await createUser({ email: "bob@test.com" });
    const m = await seedMatch(alice.id, bob.id);
    await seedMessage(m.id, alice.id, "Hello", new Date(), true);

    const caller = await callerAs(alice);
    const result = await caller.chat.getConversations();
    const json = JSON.stringify(result);
    // otherUser projection should only include id/displayName/avatarUrl/role.
    expect(json).not.toContain("bob@test.com");
    expect(json).not.toContain("passwordHash");
  });

  test("sorts conversations newest-activity first", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    // Alice <-> Bob: older conversation.
    const mAB = await seedMatch(alice.id, bob.id);
    await seedMessage(mAB.id, bob.id, "old", new Date(Date.now() - 3600_000), true);
    // Alice <-> Carol: newer.
    const mAC = await seedMatch(alice.id, carol.id);
    await seedMessage(mAC.id, carol.id, "recent", new Date(), true);

    const caller = await callerAs(alice);
    const result = await caller.chat.getConversations();
    expect(result).toHaveLength(2);
    expect(result[0].matchId).toBe(mAC.id); // carol's chat is newer
    expect(result[1].matchId).toBe(mAB.id);
  });

  test("unreadCount excludes messages sent BY the caller", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    // Alice sent these, unread-by-Bob; must NOT count toward Alice's unread.
    await seedMessage(m.id, alice.id, "Hi", new Date(Date.now() - 3 * 60_000), false);
    await seedMessage(m.id, alice.id, "Anyone?", new Date(Date.now() - 2 * 60_000), false);

    const caller = await callerAs(alice);
    const result = await caller.chat.getConversations();
    expect(result[0].unreadCount).toBe(0);
  });

  test("returns empty list when caller has no matches", async () => {
    const lonely = await createUser();
    const caller = await callerAs(lonely);
    const result = await caller.chat.getConversations();
    expect(result).toEqual([]);
  });

  test("only returns matches with status='matched' (excludes pending, closed)", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const db = getTestDb();
    // Pending match -- should not appear.
    await db.insert(matches).values({
      userAId: [alice.id, bob.id].sort()[0],
      userBId: [alice.id, bob.id].sort()[1],
      score: "0.5",
      status: "pending",
    });

    const caller = await callerAs(alice);
    const result = await caller.chat.getConversations();
    expect(result).toEqual([]);
  });
});

describe("chat.getMessages (cursor-paginated)", () => {
  test("returns messages in ASC chronological order for top-to-bottom render", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);

    const t0 = new Date(Date.now() - 3 * 60_000);
    const t1 = new Date(Date.now() - 2 * 60_000);
    const t2 = new Date(Date.now() - 1 * 60_000);
    const first = await seedMessage(m.id, alice.id, "one", t0, true);
    const second = await seedMessage(m.id, bob.id, "two", t1, true);
    const third = await seedMessage(m.id, alice.id, "three", t2, true);

    const caller = await callerAs(alice);
    const { items } = await caller.chat.getMessages({ matchId: m.id });
    expect(items.map((r) => r.id)).toEqual([first.id, second.id, third.id]);
  });

  test("secondary sort by id prevents shuffle when two messages share createdAt", async () => {
    // Regression: without ORDER BY ..., id the db can return tied
    // timestamps in arbitrary order, making the UI occasionally render
    // a later message before an earlier one (looks like sender-swap bug).
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);

    const sameTime = new Date();
    await seedMessage(m.id, alice.id, "alice-first", sameTime, true);
    await seedMessage(m.id, bob.id, "bob-tied", sameTime, true);
    await seedMessage(m.id, alice.id, "alice-also-tied", sameTime, true);

    const caller = await callerAs(alice);
    const r1 = await caller.chat.getMessages({ matchId: m.id });
    const r2 = await caller.chat.getMessages({ matchId: m.id });
    expect(r1.items.map((m) => m.id)).toEqual(r2.items.map((m) => m.id));
  });

  test("null cursor returns the newest `limit` messages + nextCursor for paging older", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    // Insert 5 messages with distinct timestamps.
    const base = Date.now() - 10 * 60_000;
    for (let i = 0; i < 5; i++) {
      await seedMessage(
        m.id,
        i % 2 === 0 ? alice.id : bob.id,
        `msg-${i}`,
        new Date(base + i * 60_000),
        true,
      );
    }
    const caller = await callerAs(alice);
    const first = await caller.chat.getMessages({ matchId: m.id, limit: 3 });
    // Newest 3 in ASC order.
    expect(first.items.map((r) => r.content)).toEqual(["msg-2", "msg-3", "msg-4"]);
    expect(first.nextCursor).not.toBeNull();

    // Follow the cursor; expect the OLDER page.
    const older = await caller.chat.getMessages({
      matchId: m.id,
      limit: 3,
      cursor: first.nextCursor,
    });
    expect(older.items.map((r) => r.content)).toEqual(["msg-0", "msg-1"]);
    // Fewer than `limit` returned -> cursor chain exhausted.
    expect(older.nextCursor).toBeNull();
  });

  test("soft-deleted messages return as tombstones with scrubbed content", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);
    const db = getTestDb();
    await seedMessage(m.id, alice.id, "oops mistake", new Date(Date.now() - 60_000), true);
    await db.update(messages).set({
      content: "[message deleted]",
      deletedAt: new Date(),
      deletedReason: "user_unsent",
    });

    const caller = await callerAs(alice);
    const { items } = await caller.chat.getMessages({ matchId: m.id });
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe("[message deleted]");
    expect(items[0].deletedAt).not.toBeNull();
  });

  test("rejects non-participant with FORBIDDEN", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const intruder = await createUser();
    const m = await seedMatch(alice.id, bob.id);

    const caller = await callerAs(intruder);
    await expect(caller.chat.getMessages({ matchId: m.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("chat.markRead", () => {
  test("marks only incoming unread messages as read (never my own)", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);

    await seedMessage(m.id, alice.id, "my sent, technically unread", new Date(), false);
    await seedMessage(m.id, bob.id, "incoming 1", new Date(), false);
    await seedMessage(m.id, bob.id, "incoming 2", new Date(), false);

    const caller = await callerAs(alice);
    await caller.chat.markRead({ matchId: m.id });

    const db = getTestDb();
    const rows = await db.select().from(messages).where(eq(messages.matchId, m.id));
    const mine = rows.find((r) => r.senderId === alice.id);
    const incoming = rows.filter((r) => r.senderId === bob.id);
    // Alice's own outgoing message: isRead unchanged (still false).
    expect(mine?.isRead).toBe(false);
    // Bob's incoming messages: now read.
    expect(incoming.every((r) => r.isRead === true)).toBe(true);
  });
});

describe("chat.sendMessage", () => {
  test("persists with correct senderId + sets messageType='text'", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const m = await seedMatch(alice.id, bob.id);

    const caller = await callerAs(alice);
    const sent = await caller.chat.sendMessage({ matchId: m.id, content: "Hello Bob" });
    expect(sent.senderId).toBe(alice.id);
    expect(sent.content).toBe("Hello Bob");
    expect(sent.messageType).toBe("text");
  });

  test("rejects non-participant", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const intruder = await createUser();
    const m = await seedMatch(alice.id, bob.id);

    const caller = await callerAs(intruder);
    await expect(
      caller.chat.sendMessage({ matchId: m.id, content: "gotcha" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
