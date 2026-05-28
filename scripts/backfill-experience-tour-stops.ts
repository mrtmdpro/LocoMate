import "dotenv/config";
import postgres from "postgres";
import { matchLabelToPlace } from "../src/lib/place-match";

/**
 * Backfill script for experience-backed tours whose `tour_data.stops` was
 * persisted in the pre-fix shape `{ time, label }` instead of the full
 * TourStop shape `{ placeId, name, scheduledTime, durationMinutes,
 * latitude, longitude, ... }`. Also inserts tour_stops rows (with best-
 * effort place matching) for tours that have none.
 *
 * Affected tours: rows where
 *   tour_data->>'isFromExperience' = 'true'
 *   AND jsonb_array_length(tour_data->'stops') > 0
 *   AND (the first stop has `label` but no `name`) OR (tour_stops is empty)
 *
 * Safe to re-run. Rows with an already-good shape + tour_stops are skipped.
 *
 *   npx tsx scripts/backfill-experience-tour-stops.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });

  // All places for label matching.
  const allPlaces = await sql<Array<{ id: string; name: string; latitude: number; longitude: number; category: string }>>`
    SELECT id, name, latitude, longitude, category FROM places
  `;

  // Pick up any experience-derived tour whose stops array is non-empty and
  // could still benefit from matching:
  //   - broken-shape (first stop has `label` but no `name`) -> pre-fix writes
  //   - no tour_stops rows -> pre-fix writes
  //   - no stops have a placeId yet -> previous backfill run used the
  //     broken substring matcher and scored zero hits; re-run with the
  //     new token-overlap matcher might find some.
  // The matching step itself is idempotent; the UPDATE below only runs when
  // the new shape differs from the persisted one.
  const candidates = await sql<Array<{
    id: string;
    tour_data: unknown;
    raw_stops: unknown;
    stops_in_tour_stops: number;
    experience_id: string | null;
    experience_duration_minutes: number | null;
    experience_category: string | null;
  }>>`
    SELECT t.id,
           t.tour_data,
           t.tour_data->'stops' AS raw_stops,
           (SELECT count(*)::int FROM tour_stops ts WHERE ts.tour_id = t.id) AS stops_in_tour_stops,
           t.experience_id,
           e.duration_minutes AS experience_duration_minutes,
           e.category AS experience_category
    FROM tours t
    LEFT JOIN experiences e ON e.id = t.experience_id
    WHERE t.tour_data->>'isFromExperience' = 'true'
      AND jsonb_typeof(t.tour_data->'stops') = 'array'
      AND jsonb_array_length(t.tour_data->'stops') > 0
      AND (
        -- broken JSON shape: first stop has label but no name
        (t.tour_data->'stops'->0 ? 'label' AND NOT (t.tour_data->'stops'->0 ? 'name'))
        -- OR tour_stops rows are missing
        OR NOT EXISTS (SELECT 1 FROM tour_stops ts WHERE ts.tour_id = t.id)
        -- OR every stop in tour_data has placeId = null (previous backfill
        -- may have used a broken matcher; re-running is cheap and safe).
        OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(t.tour_data->'stops') s
          WHERE s->>'placeId' IS NOT NULL
        )
      )
  `;

  if (candidates.length === 0) {
    console.log("No experience-derived tours need backfill.");
    await sql.end();
    return;
  }

  console.log(`Backfilling ${candidates.length} experience-derived tour(s)...`);

  for (const row of candidates) {
    const rawStops = (row.raw_stops ?? []) as Array<{
      time?: string;
      label?: string;
      name?: string;
      scheduledTime?: string;
    }>;
    const duration = row.experience_duration_minutes ?? 180;
    const category = row.experience_category ?? "cultural";
    const perStop = Math.max(15, Math.round(duration / Math.max(1, rawStops.length)));

    const rebuilt = rawStops.map((entry) => {
      const label = entry.name ?? entry.label ?? "Stop";
      const time = entry.scheduledTime ?? entry.time ?? "";
      const match = matchLabelToPlace(label, allPlaces);
      return {
        placeId: match?.id ?? null,
        name: label,
        category: match?.category ?? category,
        scheduledTime: time,
        durationMinutes: perStop,
        localTip: "",
        estimatedSpend: "",
        travelToNext: "",
        latitude: match ? Number(match.latitude) : null,
        longitude: match ? Number(match.longitude) : null,
      };
    });

    const newTourData = {
      ...(row.tour_data as Record<string, unknown>),
      stops: rebuilt,
    };

    const matched = rebuilt.filter((s) => s.placeId).length;

    // Update tour_data + refresh tour_stops atomically. If tour_stops
    // already has rows AND we have new place matches, refresh them so
    // the /host/routes heatmap picks up the new coordinates; otherwise
    // leave them (visited_at timestamps must not be clobbered).
    await sql.begin(async (tx) => {
      await tx`
        UPDATE tours SET tour_data = ${sql.json(newTourData)}, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      const needsTourStopRefresh =
        row.stops_in_tour_stops === 0 ||
        // Re-insert when we found new matches AND nobody visited yet (no
        // visited_at in any stop). This avoids destroying in-flight data.
        (matched > 0 && await hasZeroVisits(tx, row.id));
      if (needsTourStopRefresh && rebuilt.length > 0) {
        await tx`DELETE FROM tour_stops WHERE tour_id = ${row.id}`;
        await tx`
          INSERT INTO tour_stops (tour_id, place_id, stop_order, duration_minutes)
          SELECT ${row.id}, v.place_id::uuid, v.stop_order, v.duration_minutes
          FROM jsonb_to_recordset(${sql.json(rebuilt.map((s, idx) => ({
            place_id: s.placeId,
            stop_order: idx,
            duration_minutes: s.durationMinutes,
          })))}) AS v(place_id text, stop_order int, duration_minutes int)
        `;
      }
    });

    console.log(`  ${row.id}: ${rebuilt.length} stops (${matched} matched to places)`);
  }

  console.log("Backfill complete.");
  await sql.end();
}

/** Guard against clobbering visited_at timestamps from an in-flight tour. */
async function hasZeroVisits(
  tx: postgres.TransactionSql,
  tourId: string,
): Promise<boolean> {
  const rows = await tx<{ count: string }[]>`
    SELECT count(*)::text FROM tour_stops
    WHERE tour_id = ${tourId} AND visited_at IS NOT NULL
  `;
  return Number(rows[0]?.count ?? 0) === 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
