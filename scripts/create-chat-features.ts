import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent DDL for the chat production overhaul (see docs/CHAT.md).
 *
 * Adds:
 *   - messages columns: edited_at, deleted_at, deleted_reason,
 *     attachment_url, attachment_kind, flagged, flag_reason.
 *   - message_reactions table (emoji per user per message).
 *   - message_reports table (T&S queue).
 *   - user_blocks table (mutual mute).
 *   - idx_messages_created index for the 30-day retention cron.
 *   - matches.user_a_id / user_b_id become nullable + ON DELETE SET NULL
 *     so a user deleting their account tombstones their side of the chat
 *     instead of wiping the survivor's thread.
 *
 * Safe to re-run; each step checks catalog state before touching the DB.
 */

async function constraintExists(
  sql: ReturnType<typeof postgres>,
  conname: string,
): Promise<boolean> {
  const [{ exists }] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${conname}) AS exists
  `;
  return exists;
}

async function columnIsNullable(
  sql: ReturnType<typeof postgres>,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await sql<{ is_nullable: string }[]>`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `;
  if (rows.length === 0) return false;
  return rows[0].is_nullable === "YES";
}

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const sql = postgres(dbUrl, {
    ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });

  console.log("Applying chat-features DDL...");

  // 1. messages columns.
  await sql.unsafe(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_reason VARCHAR(30),
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS attachment_kind VARCHAR(20),
      ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(40)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)
  `);
  console.log("  messages: columns + idx_messages_created");

  // 2. reactions.
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji VARCHAR(16) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_uniq
      ON message_reactions(message_id, user_id, emoji)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_message_reactions_message
      ON message_reactions(message_id)
  `);
  console.log("  message_reactions");

  // 3. reports.
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS message_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason VARCHAR(40) NOT NULL,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      resolved_at TIMESTAMPTZ,
      resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_message_reports_status
      ON message_reports(status, created_at)
  `);
  console.log("  message_reports");

  // 4. blocks.
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    )
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
      ON user_blocks(blocked_id)
  `);
  console.log("  user_blocks");

  // 5. matches: relax NOT NULL + flip cascade to SET NULL so the survivor's
  //    thread isn't wiped when their counterparty deletes their account.
  //    Idempotent: we only drop the existing FK / NOT NULL if they match
  //    the pre-overhaul shape.
  const aNullable = await columnIsNullable(sql, "matches", "user_a_id");
  const bNullable = await columnIsNullable(sql, "matches", "user_b_id");
  if (!aNullable) {
    await sql.unsafe(`ALTER TABLE matches ALTER COLUMN user_a_id DROP NOT NULL`);
    console.log("  matches.user_a_id -> nullable");
  }
  if (!bNullable) {
    await sql.unsafe(`ALTER TABLE matches ALTER COLUMN user_b_id DROP NOT NULL`);
    console.log("  matches.user_b_id -> nullable");
  }

  // The original FK name Drizzle emitted depends on migration history.
  // Try the conventional names one at a time; if neither exists the FK
  // was already swapped on a previous run.
  const candidateFkNames = [
    "matches_user_a_id_users_id_fk",
    "matches_user_a_id_fkey",
  ];
  for (const name of candidateFkNames) {
    if (await constraintExists(sql, name)) {
      await sql.unsafe(`ALTER TABLE matches DROP CONSTRAINT ${name}`);
      console.log(`  dropped legacy FK ${name}`);
    }
  }
  const candidateFkNamesB = [
    "matches_user_b_id_users_id_fk",
    "matches_user_b_id_fkey",
  ];
  for (const name of candidateFkNamesB) {
    if (await constraintExists(sql, name)) {
      await sql.unsafe(`ALTER TABLE matches DROP CONSTRAINT ${name}`);
      console.log(`  dropped legacy FK ${name}`);
    }
  }
  if (!(await constraintExists(sql, "matches_user_a_id_fk"))) {
    await sql.unsafe(`
      ALTER TABLE matches
        ADD CONSTRAINT matches_user_a_id_fk
        FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log("  matches_user_a_id_fk (ON DELETE SET NULL) added");
  }
  if (!(await constraintExists(sql, "matches_user_b_id_fk"))) {
    await sql.unsafe(`
      ALTER TABLE matches
        ADD CONSTRAINT matches_user_b_id_fk
        FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log("  matches_user_b_id_fk (ON DELETE SET NULL) added");
  }

  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
