/**
 * Shape + constants for Phase A.4 — Customised Tour preference filters.
 *
 * Persisted at `userProfiles.explicitData.tourPreferences` (jsonb, no DDL).
 * The shape is also exposed as a Zod schema on the server (see
 * `user.savePersonality` in [user.router.ts](src/server/routers/user.router.ts))
 * so the API layer validates the same structure described here.
 *
 * Each axis has a Vietnamese brand label and a small English explainer.
 * The four axes correspond to the four bullet points in
 * [docs/dav startup .md](docs/dav%20startup%20.md) §2.2.
 */

import type { BrandTagTone } from "@/components/brand";

export type GuideStyle = "researcher" | "buddy";
export type RouteStyle = "walking" | "cyclo" | "vintage-bike";
export type GroupSize = "solo" | "couple" | "group6";

export interface MealPreferences {
  vegetarian: boolean;
  noSpice: boolean;
  /** Free-text allergy notes — max 10 short entries. UI offers a small
   *  chip set for the most common ones; users can also add custom. */
  allergies: string[];
}

export interface TourPreferences {
  guideStyle?: GuideStyle;
  meal?: MealPreferences;
  route?: RouteStyle;
  groupSize?: GroupSize;
}

export const GUIDE_OPTIONS: { value: GuideStyle; label: string; sub: string; tone: BrandTagTone }[] = [
  {
    value: "researcher",
    label: "Nhà nghiên cứu thâm trầm",
    sub: "Lịch sử · kiến trúc · chiều sâu văn hóa",
    tone: "flexible",
  },
  {
    value: "buddy",
    label: "Người bạn lém lỉnh",
    sub: "Sinh viên năng động · giỏi ngôn ngữ · vui vẻ",
    tone: "workshop",
  },
];

export const ROUTE_OPTIONS: { value: RouteStyle; label: string; sub: string; tone: BrandTagTone }[] = [
  {
    value: "walking",
    label: "Thong dong tản bộ",
    sub: "Qua những ngõ nhỏ phố cổ",
    tone: "esim",
  },
  {
    value: "cyclo",
    label: "Chuyến xích lô",
    sub: "Cảm xúc Đông Dương xưa",
    tone: "merch",
  },
  {
    value: "vintage-bike",
    label: "Xe máy cổ",
    sub: "Nhanh, gọn, có gió",
    tone: "fixed",
  },
];

export const GROUP_OPTIONS: { value: GroupSize; label: string; sub: string; tone: BrandTagTone }[] = [
  { value: "solo", label: "Độc hành", sub: "1 người · sâu lắng", tone: "fixed" },
  { value: "couple", label: "Song hành", sub: "Cặp đôi · 2 người", tone: "merch" },
  { value: "group6", label: "Hội ngộ", sub: "Nhóm nhỏ ≤ 6 người", tone: "workshop" },
];

export const COMMON_ALLERGIES = [
  "Hải sản",
  "Đậu phộng",
  "Bò",
  "Trứng",
  "Sữa",
  "Gluten",
] as const;

/** Returns true if any axis has been set (i.e. the user has interacted with
 *  the preferences form). Used by /plan/build to know whether to pre-fill. */
export function hasAnyPreference(p: TourPreferences | undefined | null): boolean {
  if (!p) return false;
  if (p.guideStyle || p.route || p.groupSize) return true;
  if (p.meal && (p.meal.vegetarian || p.meal.noSpice || (p.meal.allergies?.length ?? 0) > 0)) {
    return true;
  }
  return false;
}
