import { defineRouting } from "next-intl/routing";

/**
 * Locomate locale routing.
 *
 * `localePrefix: "as-needed"` keeps the canonical default-locale URLs short
 * (`/home`, `/profile`, ...) while non-default locales get an explicit
 * prefix (`/vi/home`, `/vi/profile`). next-intl's middleware also negotiates
 * locale from a stored cookie + `Accept-Language` so a user who once set
 * Vietnamese keeps landing on Vietnamese pages even when they hit a
 * prefix-less URL.
 *
 * The cookie name is shared with the App Language toggle in Settings so the
 * `user.setLocale` mutation can write the same cookie that next-intl reads.
 *
 * Adding a locale here is the only required step; the rest of the app reads
 * from `routing.locales` so picker UIs stay in sync.
 */
export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];
