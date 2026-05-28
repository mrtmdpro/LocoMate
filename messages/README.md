# Locomate message catalogues

Each locale has one JSON file (`en.json`, `vi.json`) keyed by route or
shared-component namespace, e.g.:

```jsonc
{
  "home": {
    "greeting": { "eyebrow": "Xin chào, {name}" },
    "heroSlogan": "Go a place, know its grace."
  },
  "nav": {
    "tabs": { "home": "Home", "host": "Host" }
  }
}
```

Read in client components with `useTranslations("home.greeting")` and in
server components with `getTranslations("home.greeting")`. Both locales must
have the same key shape; `next-intl` will throw on a missing key in dev.

## Brand-voice exceptions (verbatim in both locales)

The strict-mono rule for Locomate is: within a locale, only that
locale's content. The **only** exceptions are *names*, not phrases —
items the brand identity treats as proper nouns. These exist in both
`en.json` and `vi.json` with the **same value**:

- `brand.name` — `"Locomate"`. The wordmark itself.
- `brand.city` — `"Hà Nội"`. Other Locomate placenames stay in their
  native form too: `"Phố Cổ"`, `"Hoan Kiem"`, `"Bắc Ninh"`,
  `"Tràng An"`. Always include the proper diacritics.
- `brand.themeLight` / `brand.themeDark` — `"Nắng Sớm Tràng An"` /
  `"Đêm Sâu Phố Cổ"`. The two named themes in the design system. They
  are *names* the brand has chosen, not labels to translate.
- **Onboarding tone option labels** (`"Thủ thỉ tâm tình"`, `"Hóm hỉnh
  lém lỉnh"`, `"Trực diện nhanh gọn"`) — voice-personality names that
  function as proper nouns. Their descriptive sub-line **does** translate
  under `onboarding.chat.toneSub.*`. The labels themselves are inline
  literals in `app/[locale]/(auth)/onboarding/chat/page.tsx`.
- **Personality archetype labels** returned by `scorePersonality` in
  `app/src/lib/quiz-questions.ts` (`"Hồn Đa Cảm"`, `"Người Hoài Cổ"`,
  `"Lữ Khách Vị Giác"`, `"Bàn Tay Tỉ Mỉ"`, `"Linh Hồn Tĩnh"`,
  `"Người Mở Cửa"`) — same proper-noun pattern as the tone options.
  The descriptive paragraphs translate under
  `onboarding.chat.personality.*`.

When adding a new brand-voice string, list it here so future translators
know not to localise it.

## Strict monolingual rule (May 2026)

These patterns are **no longer permitted**. They mixed Vietnamese and
English on the same screen and triggered a UX-audit fix:

1. **Cross-language slogan duos.** Pairing
   `"Go a place, know its grace."` with `"Đi cho đúng, gặp cho trúng."`
   in the same hero, or `"Connected the moment you land."` /
   `"Hạ cánh là online."` on the eSIM page. The slogan now flips with
   locale: `home.greeting.slogan` is English in `en.json` and the
   Vietnamese folk-pair in `vi.json`.
2. **Bilingual eyebrows in a single string.** Eyebrows like
   `"Tour cố định · Fixed"` or `"Merch · Cửa hàng"` are gone. Use
   one language per locale: `experiences.hero.eyebrow` is
   `"Fixed Tour"` in en, `"Tour cố định"` in vi.
3. **`titleVi` / `titleEn` stacks on tour cards.** The DB carries both
   languages on every Fixed Tour, but the card now picks just one
   based on `useLocale()`:

       const primaryTitle = locale === "vi" ? tour.titleVi : tour.titleEn;

4. **Hardcoded Vi labels on detail pages.** `/fixed-tours/[id]` body
   copy (Thời lượng, Hành trình, Đặt tour, "khớp với gu của bạn") is
   keyed under `fixedTour.*`.

The only retained "second line" is the **internal language toggle**
on the fixed-tour story script — the editorial body copy can be flipped
back and forth via an explicit user button so curious travelers can
read the other language. That toggle's default tracks the active
App Language.

## Translation workflow

1. Add the English source string to `en.json` first.
2. Mirror the same key in `vi.json` with the Vietnamese translation.
3. If the source code already has a Vietnamese string (e.g.
   `"Tinh chỉnh chuyến đi."`), keep that as the canonical Vietnamese value
   and write the English equivalent.
4. Use ICU placeholders for interpolation: `"Hello {name}"`, plurals:
   `"{count, plural, =0 {no tours} =1 {one tour} other {# tours}}"`.

## Extraction status

Surfaces fully extracted (every visible string keyed):

- Shell chrome: `top-nav`, `nav-hamburger`, `primary-tabs`, `theme-toggle`
- `app/[locale]/(main)/home/page.tsx`
- `app/[locale]/(main)/settings/page.tsx`
- `app/[locale]/(main)/profile/page.tsx` (incl. `SpokenLanguagesRow`,
  `EmergencyContactsRow`)
- `app/[locale]/(auth)/login/page.tsx`
- `app/[locale]/(auth)/register/page.tsx`
- `app/[locale]/(auth)/auth/complete/page.tsx`
- `app/[locale]/(main)/host/bookings/page.tsx` (host-pairing pill)
- `app/[locale]/(public)/experiences/page.tsx` (strict-mono;
  chapters + slogans flip with locale, no cross-language secondary line)
- `app/[locale]/(public)/esim/page.tsx` (strict-mono hero; plan / FAQ
  / how-it-works fully keyed under `esim.*`)
- `app/[locale]/(main)/fixed-tours/[id]/page.tsx` (chapter labels,
  match pill, quick-fact labels, itinerary, booking form, all keyed
  under `fixedTour.*`)
- `app/[locale]/(public)/layout.tsx` (anonymous-visitor "Sign up free"
  CTA keyed under `publicShell.*`)
- `app/[locale]/(auth)/onboarding/chat/page.tsx` (tone-picker chrome +
  progress + done state + axis descriptions; the tone-option labels
  and the personality archetype labels themselves stay Vietnamese in
  both locales per the brand-voice exception list above. The LLM-
  streamed question prompts and the multi-choice answer chips both
  remain Vietnamese-only — they live in `app/src/lib/quiz-questions.ts`
  and need a coordinated prompt-template rewrite before they can
  flip with locale; tracked as a follow-up.)

Surfaces with inline English copy (deferred — both locales render
identical English strings until extracted; the locale toggle and routing
work normally):

- `app/[locale]/(auth)/onboarding/page.tsx` (the legacy "quick quiz"
  surface — the chat-style onboarding above is the primary path now)
- `app/[locale]/(auth)/host-setup/page.tsx`
- `app/[locale]/(auth)/welcome/page.tsx` (just a redirect, nothing visible)
- Public catalog: `explore`, `hosts`, `activities`,
  `design-system` and their detail pages
- Plan + Fixed Tour: `plan`, `plan/build`, `tour/[id]/*` (preview,
  active, checkout, review, wrap-up, hosts).
  `fixed-tours/[id]` is fully extracted (see above).
- Host dashboard: `host`, `host/earnings`, `host/experiences` (+
  new/edit/preview), `host/routes`
- Commerce: `cart`, `orders/[id]`, `orders/[id]/checkout`, `payments`,
  `shop`, `shop/[slug]`, `store`
- Comms: `chat`, `chat/[matchId]`, `letters`, `saved`
- Admin: `admin/flagged`, `admin/products`
- Edge surfaces: `not-found`, `error`, `security`, `profile/preferences`,
  `tours`, `plan/preferences`

These render English in both `/en/...` and `/vi/...` until a translator
takes a per-page pass. The pattern is identical to the extracted pages:
add `useTranslations("<route>")` at the top of the component, replace
inline literals with `t("key")`, mirror the key tree in `en.json` /
`vi.json`. The keys can be added in any order; next-intl will throw on
missing keys in dev so missing translations surface immediately.
