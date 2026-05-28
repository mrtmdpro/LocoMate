import "dotenv/config";
import postgres from "postgres";

// Standalone migration for the OAuth `accounts` table.
// Idempotent: safe to run multiple times; only creates missing objects.
// Using raw SQL instead of `drizzle-kit push` to avoid the interactive TTY
// prompt that broke previous migrations in non-TTY shells.

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(dbUrl, {
  ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
  max: 1,
});

async function main() {
  console.log("Creating `accounts` table if not exists...");

  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      provider VARCHAR(40) NOT NULL,
      provider_account_id VARCHAR(255) NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      expires_at INTEGER,
      token_type VARCHAR(20),
      scope VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (provider, provider_account_id)
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
  `;

  console.log("Backfilling email_verified=true for seeded demo users...");
  const result = await sql`
    UPDATE users
    SET email_verified = TRUE
    WHERE email IN (
      'alex@test.com', 'sam@test.com', 'elena@test.com',
      'yuki@test.com', 'marco@test.com',
      'nam@test.com', 'linh@test.com', 'chau@test.com'
    ) AND (email_verified IS NULL OR email_verified = FALSE);
  `;
  console.log(`  Marked ${result.count} seed users as email_verified.`);

  console.log("Done.");
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
