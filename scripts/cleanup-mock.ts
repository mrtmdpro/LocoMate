import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/server/db/schema";

const dbUrl = process.env.DATABASE_URL!;
const client = postgres(dbUrl, { ssl: dbUrl.includes("neon.tech") ? "require" : undefined });
const db = drizzle(client, { schema });

async function run() {
  // Check current state
  const bySource = await db
    .select({ source: schema.places.source, count: sql<number>`count(*)` })
    .from(schema.places)
    .groupBy(schema.places.source);

  console.log("Current places by source:");
  for (const r of bySource) {
    console.log(`  ${r.source}: ${r.count}`);
  }

  // Check category coverage from OSM pipeline
  const osmCategories = await db
    .select({ category: schema.places.category, count: sql<number>`count(*)` })
    .from(schema.places)
    .where(eq(schema.places.source, "osm_pipeline"))
    .groupBy(schema.places.category);

  console.log("\nOSM pipeline categories:");
  const osmCatMap: Record<string, number> = {};
  for (const r of osmCategories) {
    console.log(`  ${r.category}: ${r.count}`);
    osmCatMap[r.category] = Number(r.count);
  }

  // Check which mock categories have OSM replacements
  const mockCategories = await db
    .select({ category: schema.places.category, count: sql<number>`count(*)` })
    .from(schema.places)
    .where(eq(schema.places.source, "system_seeded"))
    .groupBy(schema.places.category);

  console.log("\nMock (system_seeded) categories:");
  for (const r of mockCategories) {
    const osmCount = osmCatMap[r.category] || 0;
    const status = osmCount >= 5 ? "REMOVE mock" : "KEEP mock (OSM insufficient)";
    console.log(`  ${r.category}: ${r.count} mock | ${osmCount} OSM => ${status}`);
  }

  // Delete mock places for categories that have enough OSM data (>= 5 real places)
  const categoriesToClean = Object.entries(osmCatMap)
    .filter(([, count]) => count >= 5)
    .map(([cat]) => cat);

  console.log(`\nRemoving mock data for categories with OSM coverage: ${categoriesToClean.join(", ")}`);

  // First, find mock place IDs to delete
  const mockToDelete = await db
    .select({ id: schema.places.id, category: schema.places.category })
    .from(schema.places)
    .where(sql`${schema.places.source} = 'system_seeded' AND ${schema.places.category} IN (${sql.join(categoriesToClean.map(c => sql`${c}`), sql`, `)})`);

  const mockIds = mockToDelete.map((p) => p.id);
  console.log(`  Found ${mockIds.length} mock places to remove.`);

  if (mockIds.length > 0) {
    // Clear referencing tour_stops
    for (const id of mockIds) {
      await db.delete(schema.tourStops).where(eq(schema.tourStops.placeId, id));
    }
    console.log("  Cleared referencing tour_stops.");

    // Now delete the mock places
    let deleted = 0;
    for (const id of mockIds) {
      await db.delete(schema.places).where(eq(schema.places.id, id));
      deleted++;
    }
    console.log(`  Deleted ${deleted} mock places.`);
  }

  let deleted = mockIds.length;

  // Final count
  const finalBySource = await db
    .select({ source: schema.places.source, count: sql<number>`count(*)` })
    .from(schema.places)
    .groupBy(schema.places.source);

  console.log(`\nRemoved ${deleted} mock places total.`);
  console.log("Final places by source:");
  let total = 0;
  for (const r of finalBySource) {
    console.log(`  ${r.source}: ${r.count}`);
    total += Number(r.count);
  }
  console.log(`Total: ${total}`);

  await client.end();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
