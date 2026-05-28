/**
 * Canonical set of spoken-language labels the Locomate Profile picker
 * offers, and the tRPC `user.setSpokenLanguages` mutation accepts.
 *
 * Each string is rendered exactly as written so users see the language in
 * its own script. Matching strings against the host's
 * `host_profiles.languages` array uses these as keys, so any addition
 * here MUST also be allowed in the tRPC enum at
 * `src/server/routers/user.router.ts` and in the host onboarding picker
 * at `(auth)/host-setup/page.tsx`.
 */
export const SPOKEN_LANGUAGES = [
  "English",
  "Tiếng Việt",
  "日本語",
  "한국어",
  "Français",
  "Español",
  "中文",
] as const;

export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number];
