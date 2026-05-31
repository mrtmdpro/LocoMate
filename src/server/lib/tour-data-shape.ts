import { z } from "zod";

/**
 * Typed boundary for `tours.tour_data` (jsonb) — the rendered itinerary
 * (title + stops + metadata) produced by the tour engine / booking flows.
 * Read leniently via `readTourData` (safeParse + fallback, never throws);
 * validated on write via `TourDataSchema.parse` at booking-creation sites.
 *
 * Only the fields consumers actually read are typed; `.passthrough()`
 * keeps the rest (estimatedCost, pricing, source flags, etc.) intact so
 * the write validators never reject a well-formed itinerary.
 */
export const TourDataSchema = z
  .object({
    title: z.string().optional(),
    titleEn: z.string().optional(),
    description: z.string().optional(),
    descriptionEn: z.string().optional(),
    stops: z.array(z.unknown()).optional(),
    totalDurationMinutes: z.number().optional(),
  })
  .passthrough();

export type TourData = z.infer<typeof TourDataSchema>;

export function readTourData(value: unknown): TourData {
  const parsed = TourDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}
