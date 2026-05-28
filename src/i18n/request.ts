import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Server-side request config consumed by `next-intl`'s server components
 * (anything reached via `getTranslations`, `getFormatter`, etc.). Loads the
 * matching message catalogue based on the resolved locale segment, falling
 * back to the default locale if the URL has no `[locale]` (which only
 * happens for routes outside the `[locale]` segment, e.g. `/api/...`).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
