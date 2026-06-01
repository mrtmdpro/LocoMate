import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { callerAs } from "@/test/trpc";
import { getTestDb } from "@/test/setup";
import { createUser } from "@/test/fixtures";
import { matches } from "@/server/db/schema";

async function makeMatch(userAId: string, userBId: string) {
  const db = getTestDb();
  const [userA, userB] = [userAId, userBId].sort();
  const [row] = await db
    .insert(matches)
    .values({ userAId: userA, userBId: userB, score: "0.8500", status: "matched", matchedAt: new Date() })
    .returning();
  return row;
}

describe("match.unmatch — protectedOwnedProcedure ownership gate", () => {
  test("a participant can unmatch their own match", async () => {
    const a = await createUser();
    const b = await createUser();
    const match = await makeMatch(a.id, b.id);

    const caller = await callerAs(a);
    const result = await caller.match.unmatch({ matchId: match.id });
    expect(result.success).toBe(true);

    const [updated] = await getTestDb()
      .select()
      .from(matches)
      .where(eq(matches.id, match.id));
    expect(updated.status).toBe("unmatched");
  });

  test("a non-participant is FORBIDDEN from unmatching (closes the global IDOR)", async () => {
    const a = await createUser();
    const b = await createUser();
    const outsider = await createUser();
    const match = await makeMatch(a.id, b.id);

    const caller = await callerAs(outsider);
    await expect(caller.match.unmatch({ matchId: match.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // The match is untouched.
    const [row] = await getTestDb()
      .select()
      .from(matches)
      .where(eq(matches.id, match.id));
    expect(row.status).toBe("matched");
  });

  test("unmatching a non-existent match is NOT_FOUND", async () => {
    const a = await createUser();
    const caller = await callerAs(a);
    await expect(
      caller.match.unmatch({ matchId: randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
