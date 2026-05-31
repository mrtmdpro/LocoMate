import { z } from "zod";
import type { RequestParamsWindow } from "@/lib/tour-time";

/**
 * Typed boundary for `tours.request_params` (jsonb). Stores the booking
 * scheduling + sizing inputs. Read leniently via `readRequestParams`
 * (safeParse + fallback, never throws) so the existing time-window
 * callers keep degrading gracefully; validated strictly on write via
 * `RequestParamsSchema.parse` at the booking-creation sites.
 *
 * Fields are typed with their natural types rather than tight enums so
 * that any well-formed historical row parses — `tourTimeWindow` does its
 * own date/startTime/durationHours validation downstream.
 */
export const RequestParamsSchema = z
  .object({
    date: z.string().optional(),
    startTime: z.string().optional(),
    durationHours: z.number().optional(),
    groupSize: z.number().optional(),
    fixedTourId: z.string().optional(),
    chapter: z.string().optional(),
    budgetLevel: z.string().optional(),
    withHost: z.boolean().optional(),
    interests: z.array(z.string()).optional(),
  })
  .passthrough();

export type RequestParams = z.infer<typeof RequestParamsSchema>;

// `RequestParams` must stay consumable by `tourTimeWindow` without a cast.
// This type-level assertion fails the build if the shapes diverge.
type _RequestParamsSatisfiesWindow = RequestParams extends RequestParamsWindow
  ? true
  : never;
const _windowCompat: _RequestParamsSatisfiesWindow = true;
void _windowCompat;

export function readRequestParams(value: unknown): RequestParams {
  const parsed = RequestParamsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}
