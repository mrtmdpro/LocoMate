import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { buildConfig } from "payload";

import { Articles, Guides, LegalPages } from "./src/cms/payload/collections/Editorial.ts";
import { CmsUsers } from "./src/cms/payload/collections/CmsUsers.ts";
import { Media } from "./src/cms/payload/collections/Media.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const devPayloadSecret = "locomate-dev-payload-secret-change-me-32chars";

function resolvePayloadSecret(): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("PAYLOAD_SECRET must be set to at least 32 characters in production");
  }

  return devPayloadSecret;
}

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname, "src"),
    },
    user: CmsUsers.slug,
  },
  collections: [CmsUsers, Media, Articles, Guides, LegalPages],
  db: postgresAdapter({
    migrationDir: path.resolve(dirname, "src/cms/payload/migrations"),
    pool: {
      connectionString: databaseUrl,
    },
    push: process.env.PAYLOAD_DB_PUSH === "true",
    schemaName: "payload",
  }),
  editor: lexicalEditor(),
  experimental: {
    localizeStatus: true,
  },
  localization: {
    defaultLocale: "en",
    fallback: true,
    locales: [
      { code: "en", label: "English" },
      { code: "vi", label: "Tiếng Việt" },
    ],
  },
  plugins: [
    vercelBlobStorage({
      addRandomSuffix: true,
      collections: {
        media: {
          prefix: "cms/media",
        },
      },
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
  routes: {
    admin: "/cms-admin",
    api: "/api/cms",
  },
  secret: resolvePayloadSecret(),
  typescript: {
    outputFile: path.resolve(dirname, "src/cms/payload-types.ts"),
  },
});
