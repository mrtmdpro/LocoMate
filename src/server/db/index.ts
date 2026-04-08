import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL!;

const client = postgres(connectionString, {
  ssl: connectionString.includes("neon.tech") || connectionString.includes("vercel-storage") ? "require" : undefined,
  max: process.env.NODE_ENV === "production" ? 10 : 5,
});

export const db = drizzle(client, { schema });
