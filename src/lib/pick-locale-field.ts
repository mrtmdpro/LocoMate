import type { Locale } from "@/i18n/routing";

/**
 * Picks the locale-specific field with graceful fallback:
 *   locale='vi' → row.title_vi ?? row.title_en ?? row.title
 *   locale='en' → row.title_en ?? row.title_vi ?? row.title
 *
 * Use across every render site that displays bilingual content. The
 * legacy non-suffixed field is the last-resort fallback for rows that
 * predate the migration or for partial host-authored content where only
 * one language was filled in.
 *
 * The Drizzle column names use camelCase (`titleVi`, `titleEn`) when
 * returned from tRPC, so we check both casings to be safe. We accept any
 * row shape (`unknown` -> coerced via `as`) so call sites don't need to
 * narrow their row types — bilingual rows from different tables have
 * dozens of unrelated columns (number, array, etc.) that would all
 * conflict with a strictly-typed Record signature.
 */
export function pickLocaleField<T>(
  row: unknown,
  field: string,
  locale: Locale,
): T | undefined {
  if (row === null || row === undefined || typeof row !== "object") {
    return undefined;
  }
  const r = row as Record<string, unknown>;
  const camelize = (suffix: "vi" | "en") =>
    field + suffix.charAt(0).toUpperCase() + suffix.slice(1);

  const primarySuffix = locale === "vi" ? "vi" : "en";
  const secondarySuffix = locale === "vi" ? "en" : "vi";

  // Drizzle's tRPC responses use camelCase (titleVi). The snake_case
  // versions (title_vi) are also checked because hand-rolled SQL queries
  // can return either.
  const primary =
    r[camelize(primarySuffix)] ?? r[`${field}_${primarySuffix}`];
  if (primary !== undefined && primary !== null) return primary as T;

  const secondary =
    r[camelize(secondarySuffix)] ?? r[`${field}_${secondarySuffix}`];
  if (secondary !== undefined && secondary !== null) return secondary as T;

  const legacy = r[field];
  return legacy === null ? undefined : (legacy as T | undefined);
}
