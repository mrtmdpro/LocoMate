/**
 * Run committed Payload CMS migrations against the separate `payload` schema.
 * Use `pnpm cms:bootstrap` only for a first-time empty environment.
 */
import "dotenv/config";

const [{ default: config }, { getPayload }] = await Promise.all([
  import("../payload.config.ts"),
  import("payload"),
]);

const payload = await getPayload({ config });
await payload.db.migrate();
console.log("Payload CMS migrations complete.");
