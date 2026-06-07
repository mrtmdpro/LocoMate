import type { FixedTourRow, TemplateRow } from "./types";

export const emptyPlace = {
  address: "",
  category: "cafe",
  descriptionEn: "",
  descriptionVi: "",
  isActive: true,
  isVerified: true,
  latitude: 21.0285,
  longitude: 105.8542,
  name: "",
  nameEn: "",
  nameVi: "",
  photosText: "",
  priceRange: "",
};

export const emptyFixedTour = {
  basePriceVnd: 900_000,
  chapter: "MORNING_SHIFT",
  durationMinutes: 180,
  isActive: true,
  maxParticipants: 8,
  minParticipants: 1,
  storyScriptEn: "",
  storyScriptVi: "",
  titleEn: "",
  titleVi: "",
  tourId: "",
  vectorText: "0.5,0.5,0.5,0.5",
};

export const emptyTemplate = {
  basePriceVnd: 600_000,
  durationMinutes: 360,
  isActive: true,
  maxParticipants: 4,
  storyEn: "",
  storyVi: "",
  subtitleEn: "",
  subtitleVi: "",
  templateId: "",
  theme: "balanced",
  titleEn: "",
  titleVi: "",
  vectorText: "0.5,0.5,0.5,0.5",
};

export function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function vector(value: string): [number, number, number, number] | null {
  const parsed = value.split(",").map((part) => Number(part.trim()));
  if (parsed.length !== 4 || parsed.some((n) => Number.isNaN(n) || n < 0 || n > 1)) {
    return null;
  }
  return parsed as [number, number, number, number];
}

export function rowToFixedTourForm(row: FixedTourRow) {
  return {
    basePriceVnd: row.basePriceVnd,
    chapter: row.chapter,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
    maxParticipants: row.maxParticipants,
    minParticipants: row.minParticipants,
    storyScriptEn: row.storyScriptEn,
    storyScriptVi: row.storyScriptVi,
    titleEn: row.titleEn,
    titleVi: row.titleVi,
    tourId: row.tourId,
    vectorText: Array.isArray(row.vector) ? row.vector.join(",") : emptyFixedTour.vectorText,
  };
}

export function rowToTemplateForm(row: TemplateRow) {
  return {
    basePriceVnd: row.basePriceVnd,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
    maxParticipants: row.maxParticipants,
    storyEn: row.storyEn,
    storyVi: row.storyVi,
    subtitleEn: row.subtitleEn ?? "",
    subtitleVi: row.subtitleVi ?? "",
    templateId: row.templateId,
    theme: row.theme,
    titleEn: row.titleEn,
    titleVi: row.titleVi,
    vectorText: Array.isArray(row.vector) ? row.vector.join(",") : emptyTemplate.vectorText,
  };
}

export function confirmReplace(label: string): boolean {
  return window.confirm(
    `Update "${label}"? Existing public content may change immediately if this item is active.`,
  );
}
