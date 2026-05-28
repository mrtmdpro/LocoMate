import "dotenv/config";
import postgres from "postgres";

/**
 * One-shot fix for existing hosts whose user_profiles row is missing or has
 * onboardingCompleted=false, which caused them to be redirected to the
 * traveler-only /onboarding page on every login.
 *
 * Idempotent: can be re-run safely. Inserts a profile row for hosts that
 * don't have one, and marks existing profiles complete for host/admin roles.
 *
 * Usage: `DATABASE_URL=... npx tsx scripts/backfill-host-profiles.ts`
 */

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
  console.log("Inserting missing user_profiles rows for host/admin users...");
  const inserted = await sql`
    INSERT INTO user_profiles (user_id, onboarding_completed)
    SELECT u.id, TRUE
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE up.user_id IS NULL
      AND u.role IN ('host', 'admin')
  `;
  console.log(`  Inserted ${inserted.count} new rows.`);

  console.log("Marking existing host/admin profiles onboardingCompleted=true...");
  const updated = await sql`
    UPDATE user_profiles
    SET onboarding_completed = TRUE, updated_at = NOW()
    WHERE user_id IN (
      SELECT id FROM users WHERE role IN ('host', 'admin')
    )
    AND (onboarding_completed IS NULL OR onboarding_completed = FALSE)
  `;
  console.log(`  Updated ${updated.count} rows.`);

  // Sanity: every host should now have a profile with onboardingCompleted=true.
  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE u.role = 'host') AS total_hosts,
      COUNT(up.user_id) FILTER (WHERE u.role = 'host') AS hosts_with_profile,
      COUNT(*) FILTER (WHERE u.role = 'host' AND up.onboarding_completed = TRUE) AS hosts_ready_to_login
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
  `;
  console.log("Post-backfill host stats:", stats);

  await sql.end();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
