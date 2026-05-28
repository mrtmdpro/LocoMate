# Typography

LOCOMATE's type system is tuned for readability first, density second. Text
below 12px is banned. Body copy lives at 16/17px across the app. All greys
hit WCAG 2.1 AA on white.

This doc is the source of truth. The regression guard at
[app/src/test/typography.test.ts](../src/test/typography.test.ts) fails CI if
code disagrees.

## Scale

| Token | Mobile | Desktop (`lg`+) | Line-height | When to use |
| --- | --- | --- | --- | --- |
| `.text-display` | 28px bold | 36px bold | 1.2 | Hero headlines on landing / marketing only |
| `text-4xl` | 36px | 36px | 1.1 | Rare -- hero numbers |
| `text-3xl` | 30px | 30px | 1.2 | Page H1 on desktop |
| `text-2xl` | 24px | 24px | 1.33 | Page H1 on mobile / H2 on desktop |
| `text-xl` | 20px | 20px | 1.4 | H2 on mobile / card titles on desktop |
| `text-lg` | 18px | 18px | 1.55 | Card titles, section headers |
| `.text-body` | 16px | 17px | 1.625 | **All primary body content** (bios, descriptions, messages) |
| `text-base` | 16px | 16px | 1.625 | Same as `.text-body` when desktop bump is not needed |
| `.text-body-sm` | 14px | 15px | 1.55 | Secondary paragraphs, card subtitles |
| `text-sm` | 14px | 14px | 1.55 | Button labels, nav items, metadata lines, form helper text |
| `text-xs` | 12px | 12px | 1.33 | Status pills, micro-captions, uppercase labels |

**Forbidden**: anything under 12px. No exceptions for product UI. Legal
fine print that must render below 12px should go in a footnote sheet, not
in the primary surface.

## Why 16px body minimum

- **WCAG 2.1 SC 1.4.4 Resize Text (AA)** requires text to scale to 200%
  without clipping or functional loss.
- **WCAG 2.1 SC 1.4.12 Text Spacing (AA)** requires no content loss at
  `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`,
  `paragraph-spacing: 2 × font-size`. Our 1.625 body line-height clears
  this comfortably.
- **Apple HIG (iOS)** defaults to 17pt body (≈ 22.7px rendered).
- **Material Design 3** puts "Body Large" at 16sp.
- **Nielsen Norman Group**, **BBC GEL**, and **GOV.UK Design System** all
  recommend 16px body minimum; GOV.UK bumps to 19px on desktop for
  low-literacy audiences.
- **Research**: text below 12px degrades reading speed for adult users
  even with normal vision (Bernard et al., 2001; Baymard Institute
  accessibility audits 2023).

## Contrast

| Pair | Ratio on white | WCAG status | Verdict |
| --- | --- | --- | --- |
| `text-slate-900` | 16.2 : 1 | AAA | Primary text |
| `text-slate-800` | 12.1 : 1 | AAA | Primary text |
| `text-slate-700` | 9.3 : 1 | AAA | Body copy |
| `text-slate-600` | 7.2 : 1 | AAA | Body copy |
| `text-slate-500` | 4.61 : 1 | AA | Captions, secondary -- use freely |
| `text-muted-foreground` | ~5.3 : 1 | AA | Captions, secondary -- use freely |
| `text-slate-400` | 3.35 : 1 | **FAIL** | **Forbidden** on white backgrounds |
| `text-gray-400` | 3.35 : 1 | **FAIL** | **Forbidden** on white backgrounds |

The guard test blocks any `text-slate-400` / `text-gray-400` reintroduction.

Brand pairs we rely on:

| Foreground | Background | Ratio | Verdict |
| --- | --- | --- | --- |
| `#3f6f60` (brand green) | white | 5.42 : 1 | AA |
| `#ff8c30` (brand orange) | white | 3.16 : 1 | **Large text only (≥ 18pt)** -- never use on small body copy |
| `#ff8c30` | `#3f6f60` | varies -- check per usage |  |
| white | `#ff8c30` | 3.16 : 1 | **Large / bold text only** |

If you need orange on white for body copy, use `#e67a20` (our hover
variant) which hits 4.53 : 1.

## Line length

Long-form prose (host bios, activity descriptions, product details, policy
copy, email-style messages) **must** apply `max-w-prose` (65ch ≈ the
Bringhurst sweet spot of 66 characters per line). This keeps the eye from
tracking too far horizontally on desktop.

```tsx
<p className="text-body text-slate-700 max-w-prose">{longDescription}</p>
```

## Tap targets

WCAG 2.5.5 (AAA) and Apple HIG: 44 × 44 CSS pixels minimum. Material uses
48 × 48dp. We target **44 × 44** (`h-11 w-11`).

Common fixups:

- Back buttons sitting in a hero: `w-11 h-11 rounded-full bg-white/90`.
- Chat quick-chips: `h-9` + padding = 36px tall; acceptable in a scroll
  tray where they're intentionally compact, but anything stand-alone
  should be `h-11`.
- Icon-only buttons in toolbars: `h-11 w-11 p-0`.
- Quantity steppers (`+` / `-`): `w-11 h-11` on detail pages, `w-9 h-9`
  inside compact cart rows with surrounding margin.

## Headings

Always pair headings with a responsive desktop bump so they carry on wider
screens without looking cramped:

```tsx
<h1 className="text-2xl lg:text-3xl font-bold font-heading">Page title</h1>
<h2 className="text-lg lg:text-xl font-semibold">Section title</h2>
<h3 className="text-base lg:text-lg font-semibold">Card title</h3>
```

Use `leading-snug` (1.375) on headings for tight, newspaper-style stacking.

## Utility classes

Three custom classes live in [app/src/app/globals.css](../src/app/globals.css):

- **`.text-body`** -- 16px mobile / 17px desktop, 1.625 line-height, for
  every paragraph of prose.
- **`.text-body-sm`** -- 14px mobile / 15px desktop, for secondary copy.
- **`.text-meta`** -- 12px fixed, for captions directly below a value.
- **`.text-display`** -- 28px mobile / 36px desktop, for marketing hero
  headlines.

Prefer these over raw `text-sm` / `text-base` when you want the canonical
reading surface. They guarantee the responsive bump and line-height
pairing.

## Do / Don't

| Do | Don't |
| --- | --- |
| `<p className="text-body text-slate-700 max-w-prose">` for prose | `<p className="text-xs text-muted">` for sentences |
| `<h1 className="text-2xl lg:text-3xl font-bold">` for page titles | `<h1 className="text-lg font-bold">` fixed-size |
| `<Badge className="text-xs px-3 h-9 ...">` on chat chips | `<Badge className="text-[9px] px-1 py-0.5">` |
| `<button className="w-11 h-11 ...">` for icon buttons | `<button className="w-7 h-7 ...">` |
| `text-slate-500` / `text-muted-foreground` for captions | `text-slate-400` / `text-gray-400` |

## Regression guard

Run the guard locally:

```bash
pnpm test src/test/typography.test.ts
```

CI runs the same test in the full suite. If it fails, the error message
tells you exactly which file and line introduced the violation.

If you genuinely need an exemption (e.g. a legal disclaimer at 10px to
match a printed notice), open a PR that edits
[typography.test.ts](../src/test/typography.test.ts) with the exemption
AND a comment explaining why. Reviews require explicit approval.

## References

- [WCAG 2.1](https://www.w3.org/TR/WCAG21/) -- the full standard
- [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/)
- [Apple HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Material Design 3 Type scale](https://m3.material.io/styles/typography/type-scale-tokens)
- [GOV.UK Design System typography](https://design-system.service.gov.uk/styles/typography/)
- [Nielsen Norman: Legible Font Sizes](https://www.nngroup.com/articles/legible-font-size/)
