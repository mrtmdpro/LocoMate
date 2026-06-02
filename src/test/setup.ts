// Set deterministic test env BEFORE any module imports below (which transitively
// pull in src/server/db/index.ts that reads DATABASE_URL at module load time).
// Using `beforeAll` here would be too late — vitest's `setupFiles` body still
// runs before each test file's top-level imports, so any env vars needed at
// module-load time must be set at the top of this file, not inside a hook.
process.env.JWT_SECRET ??= "test-jwt-secret-minimum-thirty-two-characters!!";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.OAUTH_REDIRECT_BASE ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgres://test/test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import { beforeAll, afterAll, afterEach } from "vitest";
import * as schema from "../server/db/schema";
import { SCHEMA_DDL } from "../../scripts/apply-all-ddl";

/**
 * One PGlite instance per Vitest worker, lazily booted. Tests share it via the
 * exported `testDb` getter and reset their state via `resetDb` between cases.
 *
 * PGlite is a real Postgres running in WASM in-process. It produces the same
 * SQL planner + constraint errors as Neon, so integration tests catch foreign
 * key / unique violations the same way production would.
 */

type Schema = typeof schema;
type TestDb = ReturnType<typeof drizzle<Schema>>;

let pglite: PGlite | undefined;
let _db: TestDb | undefined;

export function getTestDb(): TestDb {
  if (!_db) {
    throw new Error("Test DB not initialised; ensure setup.ts runs in beforeAll.");
  }
  return _db;
}

// Deterministic env the tested code reads (auth middleware, oauth helpers).
// The env-var assignments live above the imports — see the comment at the top
// of this file. Anything that doesn't need to be ready at module-load time
// stays in beforeAll.
beforeAll(async () => {
  pglite = await PGlite.create();
  _db = drizzle(pglite, { schema });

  // Drizzle committed migrations 0000-0003 create users/places/tours/etc.
  await migrate(_db, {
    migrationsFolder: path.resolve(__dirname, "../server/db/migrations"),
  });

  // The post-migration DDL (accounts, marketplace, products, chat, fixed
  // tours, crossover, coupons, sessions, ...) is owned by the canonical
  // builder `scripts/apply-all-ddl.ts` -- the SAME ordered list the CI
  // `schema-drift` job and `pnpm db:check` apply to a real Postgres. Replaying
  // it here (instead of a hand-mirrored copy) keeps the test schema and the
  // production DDL path on one source of truth. PGlite uses the extended query
  // protocol but every statement in SCHEMA_DDL is a single statement, so
  // `execute` accepts them one at a time.
  for (const stmt of SCHEMA_DDL) {
    await _db.execute(sql.raw(stmt));
  }
});

afterAll(async () => {
  await pglite?.close();
  pglite = undefined;
  _db = undefined;
});

/**
 * Truncate all app tables between tests. Faster than re-running migrations.
 * Order matters for some FKs but `CASCADE` handles the tree.
 */
async function resetDb() {
  if (!_db) return;
  // Single TRUNCATE with a comma-separated list IS a single SQL statement per
  // Postgres grammar, so PGlite's extended protocol accepts it.
  await _db.execute(sql.raw(
    "TRUNCATE TABLE sessions, accounts, reports, emergency_contacts, reviews, host_payouts, " +
    "thank_you_letters, " +
    "priority_matching_vouchers, crossover_discovery_pushes, escrow_adjustments, " +
    "tour_proposal_edits, tour_crossover_requests, " +
    "order_items, orders, cart_items, activity_slots, activities, " +
    "product_variants, products, payments, tour_stops, tours, " +
    "fixed_tour_tags, fixed_tour_steps, fixed_tours, " +
    "message_reactions, message_reports, user_blocks, messages, " +
    "swipe_actions, matches, saved_hosts, saved_places, experiences, places, " +
    "host_availability, host_profiles, user_profiles, users " +
    "RESTART IDENTITY CASCADE",
  ));
}

afterEach(resetDb);

export { resetDb };
