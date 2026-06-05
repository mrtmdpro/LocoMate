/**
 * One-time Payload schema bootstrap.
 *
 * This intentionally enables Payload's Postgres `push` mode for this process
 * only, so a fresh environment can create the separate `payload` schema before
 * editors visit /cms-admin. After bootstrap, normal deploys should use
 * `pnpm cms:migrate` and keep PAYLOAD_DB_PUSH unset.
 */
import "dotenv/config";

async function main() {
  process.env.PAYLOAD_DB_PUSH = "true";

  const [{ default: config }, { getPayload }] = await Promise.all([
    import("../payload.config.ts"),
    import("payload"),
  ]);

  const payload = await getPayload({ config });
  await payload.db.init?.();
  console.log("Payload CMS schema bootstrapped.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
