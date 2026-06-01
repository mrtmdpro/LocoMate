import "dotenv/config";
import postgres from "postgres";

// Standalone migration for the server-side refresh-token `sessions` table
// (Cluster C auth lifecycle). Idempotent: safe to run multiple times; only
// creates missing objects. Raw SQL (not `drizzle-kit push`) to avoid the
// interactive TTY prompt that broke previous migrations in non-TTY shells.

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
  console.log("Creating `sessions` table if not exists...");

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash VARCHAR(64) NOT NULL,
      family_id UUID NOT NULL,
      user_agent VARCHAR(400),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash
      ON sessions(refresh_token_hash);
  `;

  console.log("Done.");
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
