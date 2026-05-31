import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent migration: add the three crossover unique indexes that close
 * the multi-write races in `crossover.router.ts` (Cluster B).
 *
 *   1. uq_escrow_adjustments_request — UNIQUE(crossover_request_id):
 *      one escrow row per request. Backs lockItinerary's idempotency so
 *      a concurrent double-lock collides instead of inserting twice.
 *   2. uq_crossover_requests_pending — partial UNIQUE(requester_user_id,
 *      target_tour_id) WHERE status = 'pending': no duplicate pending
 *      requests to the same target.
 *   3. idx_tours_crossover_pair — partial UNIQUE(crossover_pair_id)
 *      WHERE crossover_pair_id IS NOT NULL: 1:1 tour pairing. The
 *      schema.ts comment claimed this index existed; this script
 *      reconciles the drift.
 *
 * SAFETY: each index is created with `IF NOT EXISTS`, but a UNIQUE index
 * over dirty data fails the whole CREATE. So we FIRST query for existing
 * violators per index; if any exist we PRINT them and SKIP that index
 * (we never force-create over duplicates). Resolve the rows by hand, then
 * re-run.
 *
 *   npx tsx scripts/add-crossover-unique-constraints.ts
 */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, {
    ssl: databaseUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });

  let skipped = 0;

  try {
    // ── 1. escrow_adjustments.crossover_request_id ────────────────────
    {
      const violators = await sql`
        SELECT crossover_request_id, COUNT(*) AS n
          FROM escrow_adjustments
          GROUP BY crossover_request_id
          HAVING COUNT(*) > 1
      `;
      if (violators.length > 0) {
        skipped++;
        console.error(
          `[uq_escrow_adjustments_request] SKIPPED — ${violators.length} crossover_request_id(s) have >1 escrow row:`,
        );
        for (const v of violators) {
          console.error(`  crossover_request_id=${v.crossover_request_id} count=${v.n}`);
        }
      } else {
        console.log("[uq_escrow_adjustments_request] no violators; creating index...");
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_escrow_adjustments_request
            ON escrow_adjustments (crossover_request_id)
        `;
        console.log("[uq_escrow_adjustments_request] done.");
      }
    }

    // ── 2. tour_crossover_requests (requester, target) WHERE pending ──
    {
      const violators = await sql`
        SELECT requester_user_id, target_tour_id, COUNT(*) AS n
          FROM tour_crossover_requests
          WHERE status = 'pending'
          GROUP BY requester_user_id, target_tour_id
          HAVING COUNT(*) > 1
      `;
      if (violators.length > 0) {
        skipped++;
        console.error(
          `[uq_crossover_requests_pending] SKIPPED — ${violators.length} (requester, target) pair(s) have >1 pending request:`,
        );
        for (const v of violators) {
          console.error(
            `  requester=${v.requester_user_id} target=${v.target_tour_id} count=${v.n}`,
          );
        }
      } else {
        console.log("[uq_crossover_requests_pending] no violators; creating index...");
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_crossover_requests_pending
            ON tour_crossover_requests (requester_user_id, target_tour_id)
            WHERE status = 'pending'
        `;
        console.log("[uq_crossover_requests_pending] done.");
      }
    }

    // ── 3. tours.crossover_pair_id (partial, non-null) ────────────────
    {
      const violators = await sql`
        SELECT crossover_pair_id, COUNT(*) AS n
          FROM tours
          WHERE crossover_pair_id IS NOT NULL
          GROUP BY crossover_pair_id
          HAVING COUNT(*) > 1
      `;
      if (violators.length > 0) {
        skipped++;
        console.error(
          `[idx_tours_crossover_pair] SKIPPED — ${violators.length} crossover_pair_id(s) referenced by >1 tour:`,
        );
        for (const v of violators) {
          console.error(`  crossover_pair_id=${v.crossover_pair_id} count=${v.n}`);
        }
      } else {
        console.log("[idx_tours_crossover_pair] no violators; creating index...");
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_tours_crossover_pair
            ON tours (crossover_pair_id)
            WHERE crossover_pair_id IS NOT NULL
        `;
        console.log("[idx_tours_crossover_pair] done.");
      }
    }

    if (skipped > 0) {
      console.error(
        `\n${skipped} index(es) skipped due to existing violators. Resolve the rows above and re-run.`,
      );
      process.exitCode = 1;
    } else {
      console.log("\nAll crossover unique indexes are present.");
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
