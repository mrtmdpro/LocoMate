import type { CSSProperties, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * The five official brand marks delivered by the design team in
 * `/Bộ Nhận Diện/Logo/lo co-5/`. Each maps to one Locomate surface:
 *
 *   LocomateMascot  → Brand logo mark (large hero presence)
 *   MapMarker       → Map pins (the compact mascot with embedded "L")
 *   Pagoda          → Fixed Tours
 *   Cyclo           → Customised (Flexible) Tours
 *   Basket / Cart   → Merchandise / eSIM / Cart   (same component;
 *                     `Cart` is the design team's canonical name,
 *                     `Basket` is the back-compat export.)
 *
 * The path data here is the design team's original. We only normalise
 * colours: brand-brick (#9B2828) becomes `currentColor` so the icon
 * inherits the surrounding text colour, and white highlights resolve
 * to `var(--paper)` so they shift cleanly across light + dark mode.
 *
 * The raw 1500×1500 SVGs are also exported at `/public/brand/*.svg`
 * (pagoda, cyclo, cart, logo, map, text, logo-with-text) for marketing
 * use. The `LogoWithText` React component below renders the full
 * lockup via that asset.
 */

export interface BrandIconProps {
  /** Rendered pixel size (sets both width and height). Default 48. */
  size?: number;
  /** Extra Tailwind / class names appended to the root <svg>. */
  className?: string;
  /** Inline style overrides — useful for opacity / positioning the
   *  icon as a watermark behind content. */
  style?: CSSProperties;
  /** Aria label. When omitted, the icon is decorative (aria-hidden). */
  title?: string;
}

function iconProps({ size = 48, className, style, title }: BrandIconProps) {
  return {
    width: size,
    height: size,
    className: cn(className),
    style,
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
    role: title ? "img" : undefined,
  } as const;
}

/* ─── PAGODA — Fixed Tours ────────────────────────────────────────────── */

export function Pagoda(props: BrandIconProps) {
  return (
    <svg
      {...iconProps(props)}
      viewBox="146 758 118 92"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M258.5,801.5H149.9c-0.5,0-0.9-0.4-0.9-0.9v-3.4c0-0.5,0.4-0.9,0.9-0.9h108.6c0.5,0,0.9,0.4,0.9,0.9v3.4 C259.4,801.1,259,801.5,258.5,801.5z" />
      <path d="M170.3,800.5h-7v33.7c0,1,0.8,1.7,1.7,1.8l5.3-3.9V800.5z" />
      <path d="M238.8,800.5h7v33.7c0,1-0.8,1.7-1.7,1.8l-5.3-3.9V800.5z" />
      <path d="M241.7,778.8c-3.2-2-6.4-16.6-6.4-16.6s0.3-1.2,1.1-3.7c0.8-2.4-0.6-3-0.6-3c-6.6-0.2-7.5,6.7-7.5,6.7H206 h-3.5h-22.3c0,0-0.9-6.9-7.5-6.7c0,0-1.4,0.6-0.6,3c0.8,2.4,1.1,3.7,1.1,3.7s-3.2,14.6-6.4,16.6c-3.2,2-17.2,11.6-32,1.7 c0,0,0.8,10.4,11.1,11.4c9.2,0.9,49.4,0.2,58.3,0c8.9,0.2,49.1,0.9,58.3,0c10.4-1.1,11.1-11.4,11.1-11.4 C258.9,790.4,244.9,780.8,241.7,778.8z" />
      <path d="M204.2,805.2c0,0-29.3,38.1-62.7,41c0,0,28.2,3.4,62.7-24.5V805.2z" />
      <path d="M204.2,805.2c0,0,29.3,38.1,62.7,41c0,0-28.2,3.4-62.7-24.5V805.2z" />
    </svg>
  );
}

/* ─── CYCLO — Customised Tours ────────────────────────────────────────── */

export function Cyclo(props: BrandIconProps) {
  return (
    <svg
      {...iconProps(props)}
      viewBox="508 755 196 134"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="currentColor" strokeWidth={3.36} strokeMiterlimit={10}>
        <circle cx="598.7" cy="842.1" r="8.6" />
        <path d="M568.4,812.8c-4.1,4.1-8.2,8.2-12.2,12.3" />
      </g>
      <path d="M552.7,842.1c0,7.9-6.4,14.3-14.3,14.3c-7.9,0-14.3-6.4-14.3-14.3c0-7.9,6.4-14.3,14.3-14.3 c4.2,0,8,1.8,10.6,4.7c2.4-2.4,4.8-4.9,7.3-7.3c-2.4,2.4-4.8,4.9-7.3,7.3C551.3,835,552.7,838.4,552.7,842.1h10.5 c0-13.7-11.1-24.8-24.8-24.8c-13.7,0-24.8,11.1-24.8,24.8c0,13.7,11.1,24.8,24.8,24.8c13.7,0,24.8-11.1,24.8-24.8H552.7z" />
      <g fill="none" stroke="currentColor" strokeWidth={3.36} strokeMiterlimit={10}>
        <path d="M548.9,832.5c-2.6-2.9-6.4-4.7-10.6-4.7c-7.9,0-14.3,6.4-14.3,14.3c0,7.9,6.4,14.3,14.3,14.3 c7.9,0,14.3-6.4,14.3-14.3h-13.3C542.6,838.9,545.8,835.7,548.9,832.5z" />
        <path d="M539.4,842.1h13.3c0-3.7-1.4-7.1-3.7-9.6C545.8,835.7,542.6,838.9,539.4,842.1z" />
        <line x1="563.2" y1="842.1" x2="590.1" y2="842.1" />
        <line x1="607.3" y1="842.1" x2="620.8" y2="842.1" />
      </g>
      <path d="M634.3,833.4L626,827c-3.2,4.2-5.2,9.4-5.2,15.1h10.5C631.3,838.8,632.4,835.8,634.3,833.4z" />
      <path d="M645.6,817.3c-8,0-15.1,3.8-19.6,9.7l8.3,6.4c2.6-3.4,6.7-5.6,11.3-5.6c7.9,0,14.3,6.4,14.3,14.3 c0,7.9-6.4,14.3-14.3,14.3c-7.9,0-14.3-6.4-14.3-14.3h-10.5c0,13.7,11.1,24.8,24.8,24.8s24.8-11.1,24.8-24.8 C670.4,828.4,659.3,817.3,645.6,817.3z" />
      <g fill="none" stroke="currentColor" strokeWidth={3.36} strokeMiterlimit={10}>
        <path d="M645.6,842.1l-11.3-8.7c-1.9,2.4-3,5.4-3,8.7H645.6z" />
        <path d="M631.3,842.1c0,7.9,6.4,14.3,14.3,14.3c7.9,0,14.3-6.4,14.3-14.3c0-7.9-6.4-14.3-14.3-14.3 c-4.6,0-8.7,2.2-11.3,5.6l11.3,8.7H631.3z" />
        <line x1="593.1" y1="835.6" x2="568.4" y2="812.8" />
        <line x1="568.4" y1="798.5" x2="568.4" y2="812.8" />
      </g>
      <path d="M559.3,788.9c2-0.6,4.1-0.2,6.2,0.3c2,0.5,4,1.2,6.1,1.3c1.6,0.1,3.2-0.2,4.7-0.3c1.6-0.1,3.2,0.1,4.6,1 c1.3,0.9,2.2,2.6,1.7,4.1c-0.4,1-1.3,1.8-2.3,2.2c-1,0.4-2.1,0.5-3.2,0.5c-4.7,0.3-9.5,0.7-14.2,1c-1.6,0.1-3.4,0.2-4.8-0.7 C554.2,795.9,555,790.1,559.3,788.9z" />
      <g fill="none" stroke="currentColor" strokeWidth={3.36} strokeMiterlimit={10}>
        <path d="M594.2,779c2.3-1.4,7.4-0.8,9.2,0.4c2,1.3,3.7,3.1,4.9,5.2" />
        <path d="M687,841.6c-1.8-0.2-3.5-1.3-4.6-2.7s-1.9-3.1-2.6-4.8c-1.8-4.4-3.4-8.9-5.7-13c-2.3-4.1-5.7-7.5-9.7-9.9 c-5.5-3.3-12.1-4.8-18.4-4.1c-2.8,0.3-5.6,0.9-8.4,1s-5.8-0.6-7.8-2.6c-1.9-1.9-2.7-4.6-3.3-7.3c-2.4-9.6-4.8-19.1-7.1-28.7 c-0.6-2.4-1.2-4.8-2.8-6.7s-4.3-3-6.5-2c-1.5,0.7-2.4,2.2-2.8,3.8c-0.4,1.6-0.3,3.2-0.2,4.9c0.6,9.3,1.2,18.7,3.2,27.9 c2,9.1,5.5,18.1,11.4,25.4c1.3,1.7,2.6,3,4.4,4.3" />
        <path d="M697.2,839.5c-0.9,2.5-4.3,2.1-7,2.1c-1.1,0-2.2,0-3.3,0" />
        <path d="M687,841.6c-1.6,0-3.2,0-4.9,0c-3.9,0-7.8,0-11.7,0" />
        <line x1="637.9" y1="808.4" x2="637.9" y2="818.9" />
        <path d="M625.2,793.8h34.7c4.4,0,8.6,1.8,11,5.5" />
        <line x1="658.8" y1="794.3" x2="658.8" y2="808.6" />
      </g>
    </svg>
  );
}

/* ─── BASKET — Merch / eSIM / Cart ────────────────────────────────────── */

const BASKET_WEAVE_LINES: [number, number, number, number][] = [
  // Each tuple is [x1, y1, x2, y2] of one bamboo strand. Lifted
  // verbatim from the design team's original, kept in order for any
  // future diffing against the source SVG.
  [353.9, 794.5, 343.3, 804.8],
  [343.3, 804.8, 335.0, 812.8],
  [377.4, 794.5, 365.7, 806.3],
  [338.4, 833.8, 343.0, 829.2],
  [365.7, 806.3, 355.2, 816.9],
  [355.2, 816.9, 343.0, 829.2],
  [342.5, 856.2, 342.9, 855.8],
  [378.2, 818.8, 367.8, 829.7],
  [389.7, 806.7, 378.2, 818.8],
  [342.9, 855.8, 355.9, 842.2],
  [355.9, 842.2, 367.8, 829.7],
  [401.4, 794.5, 389.7, 806.7],
  [356.5, 868.2, 368.6, 854.9],
  [347.8, 877.7, 356.5, 868.2],
  [368.6, 854.9, 380.2, 842.3],
  [380.2, 842.3, 390.5, 831.1],
  [401.8, 818.8, 390.5, 831.1],
  [424.1, 794.5, 413.4, 806.1],
  [413.4, 806.1, 401.8, 818.8],
  [393.0, 855.2, 402.9, 843.6],
  [435.5, 805.4, 425.2, 817.5],
  [413.8, 830.8, 402.9, 843.6],
  [425.2, 817.5, 413.8, 830.8],
  [444.8, 794.5, 435.5, 805.4],
  [381.9, 868.2, 393.0, 855.2],
  [373.3, 878.3, 381.9, 868.2],
  [455.2, 805.1, 446.4, 815.8],
  [464.1, 794.5, 455.2, 805.1],
  [446.4, 815.8, 436.2, 828.2],
  [424.9, 841.8, 436.2, 828.2],
  [414.1, 854.9, 424.9, 841.8],
  [404.3, 866.7, 414.1, 854.9],
  [396.3, 876.4, 404.3, 866.7],
  [414.5, 878.3, 415.1, 877.7],
  [448.3, 839.9, 459.0, 827.8],
  [415.1, 877.7, 425.3, 866.1],
  [436.5, 853.3, 448.3, 839.9],
  [459.9, 826.7, 459.0, 827.8],
  [436.5, 853.3, 425.3, 866.1],
  [402.9, 843.6, 414.1, 854.9],
  [425.3, 866.1, 414.1, 854.9],
  [390.5, 831.1, 402.9, 843.6],
  [365.7, 806.3, 353.9, 794.5],
  [425.3, 866.1, 437.4, 878.3],
  [365.7, 806.3, 378.2, 818.8],
  [390.5, 831.1, 378.2, 818.8],
  [452.2, 869.0, 449.4, 866.1],
  [389.7, 806.7, 377.4, 794.5],
  [436.5, 853.3, 424.9, 841.8],
  [449.4, 866.1, 436.5, 853.3],
  [413.8, 830.8, 424.9, 841.8],
  [413.8, 830.8, 401.8, 818.8],
  [389.7, 806.7, 401.8, 818.8],
  [448.3, 839.9, 456.2, 847.6],
  [436.2, 828.2, 425.2, 817.5],
  [413.4, 806.1, 425.2, 817.5],
  [413.4, 806.1, 401.4, 794.5],
  [448.3, 839.9, 436.2, 828.2],
  [435.5, 805.4, 424.1, 794.5],
  [435.5, 805.4, 446.4, 815.8],
  [459.0, 827.8, 446.4, 815.8],
  [455.2, 805.1, 444.8, 794.5],
  [455.2, 805.1, 462.2, 812.3],
  [415.7, 878.3, 415.1, 877.7],
  [393.0, 855.2, 404.3, 866.7],
  [393.0, 855.2, 380.2, 842.3],
  [343.3, 804.8, 355.2, 816.9],
  [404.3, 866.7, 415.1, 877.7],
  [367.8, 829.7, 355.2, 816.9],
  [333.2, 794.5, 343.3, 804.8],
  [367.8, 829.7, 380.2, 842.3],
  [343.0, 829.2, 336.6, 822.8],
  [368.6, 854.9, 355.9, 842.2],
  [392.0, 878.3, 381.9, 868.2],
  [368.6, 854.9, 381.9, 868.2],
  [343.0, 829.2, 355.9, 842.2],
  [367.6, 878.3, 356.5, 868.2],
  [342.9, 855.8, 342.3, 855.2],
  [342.9, 855.8, 356.5, 868.2],
  [449.4, 866.1, 438.9, 877.5],
];

export function Basket(props: BrandIconProps) {
  return (
    <svg
      {...iconProps(props)}
      viewBox="328 750 144 134"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M452.3,876.4c0,0,0.1,1.5-2.2,3.4c-2.3,1.9-48.1,0.8-48.1,0.8s-52.9,1-55.2-0.8c-2.3-1.9-2.2-3.4-2.2-3.4 s-0.1-0.3-0.2-0.8" />
      <line x1="450.8" y1="876.4" x2="346.2" y2="875.6" stroke="currentColor" />
      <path d="M465.1,794.5H332c-0.6,0-1-0.5-1-1v-0.6c0-2.6,2.1-4.7,4.7-4.7h125.1c2.9,0,5.3,2.4,5.3,5.3v0 C466.1,794.1,465.6,794.5,465.1,794.5z" />
      <path d="M397.8,787.2c11.4,0,20.8-5.6,21.4-12.7c0,0,0-0.1,0-0.1c0-0.4,0-0.7,0-1.1c-0.4-7.2-9.8-13-21.4-13 c-11.9,0-21.5,6-21.5,13.4c0,0.3,0,0.5,0,0.8C377,781.6,386.4,787.2,397.8,787.2z M397.8,763.3c9.2,0,16.7,4.7,16.7,10.5 c0,0.3,0,0.5-0.1,0.8c-0.6,5.4-7.8,9.7-16.6,9.7c-8.8,0-16-4.3-16.6-9.7c0-0.3-0.1-0.5-0.1-0.8C381.1,768,388.6,763.3,397.8,763.3z" />
      <path d="M431.2,788.3c-0.6,0-1.1,0-1.6,0h0h0c-3.6-0.2-6.9-2.1-8.8-5.1c-2.4-3.8-1.4-7.9-1.4-8.7 c-0.6,7.1-10,12.7-21.4,12.7c-11.4,0-20.8-5.6-21.4-12.7c0,0.8,1.1,4.9-1.4,8.7c-2.2,3.4-6.2,5.4-10.5,5.1h-6.3v3.1h82.9v-3.1h-8.9 H431.2z" />
      <g fill="none" stroke="currentColor" strokeMiterlimit={10}>
        <path strokeWidth={2.83} d="M338.4,833.8c-0.6-3.7-1.3-7.3-1.8-11" />
        <path strokeWidth={2.83} d="M338.4,833.8c1.3,7.5,2.7,15,3.9,21.5" />
        <path strokeWidth={2.83} d="M335,812.8c0.5,3.2,1,6.6,1.6,10" />
        <path strokeWidth={2.83} d="M333.4,801.2c0.4,3.5,1,7.4,1.6,11.6" />
        <path strokeWidth={2.73} d="M345.9,876c-0.4-2.4-1.7-10-3.4-19.8" />
        <path strokeWidth={2.83} d="M333.4,801.2c-0.4-3.3-0.7-6.3-0.8-8.6" />
        <path strokeWidth={2.83} d="M459.9,826.7c0.8-4.9,1.6-9.8,2.3-14.3" />
        <path strokeWidth={2.83} d="M453.7,861.5c0.8-4.1,1.7-8.8,2.6-13.9" />
        <path strokeWidth={2.83} d="M459.6,828.4c-1.1,6.5-2.3,13.1-3.4,19.2" />
        <path strokeWidth={2.83} d="M452.2,869c-0.9,4.6-1.5,7.5-1.5,7.5" />
        <path strokeWidth={2.83} d="M463.8,800.6c-0.4,3.5-1,7.4-1.6,11.7" />
        <path strokeWidth={2.83} d="M453.7,861.5c-0.5,2.8-1,5.3-1.4,7.5" />
        <path strokeWidth={2.83} d="M464.5,792.8c-0.1,2.2-0.4,4.8-0.7,7.8" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth={3.83} strokeMiterlimit={10}>
        {BASKET_WEAVE_LINES.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <line
        x1="452.9"
        y1="861"
        x2="449.4"
        y2="866.1"
        stroke="currentColor"
        strokeWidth={3.69}
        fill="none"
        strokeMiterlimit={10}
      />
    </svg>
  );
}

/* ─── BUFFALO HORN — Chat (Tù và sừng trâu) ───────────────────────────── */

/**
 * Side-profile silhouette of a tù và sừng trâu — the buffalo horn
 * used as a signal and ceremonial instrument in Tonkin highland
 * culture. Narrow mouthpiece on the left, flared bell opening on the
 * right, with a small paper-coloured blow-hole detail at the
 * mouthpiece tip (same paper-cutout trick the LocomateMascot uses for
 * its eyes).
 *
 * Unlike the other four brand marks in this file, this one is an
 * in-house addition rather than a design-team deliverable from
 * `/Bộ Nhận Diện/Logo/lo co-5/`. The current path is a working
 * sketch — the Chat nav tab originally wore this mark but the glyph
 * didn't read cleanly enough at 20 px, so the nav was switched to
 * the universal Heroicons chat-bubble outline (see
 * `app/src/lib/nav.ts`). The component is kept here for when the
 * design team delivers a refined asset; swap the path data then —
 * the component contract (BrandIconProps in, decorative-by-default
 * 24×24 SVG out) stays stable so future callers don't need to
 * change.
 *
 * Used by: nothing in the live UI today. Available for future
 * surfaces (cultural section dividers, host-storyteller badges,
 * etc.) once the asset is design-approved.
 */
export function BuffaloHorn(props: BrandIconProps) {
  return (
    <svg
      {...iconProps(props)}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 10 C 4 6, 8 4.6, 13 4.8 C 18.5 5, 21.5 7.4, 21.5 11 L 21.5 13.5 L 17.6 13.5 C 17.6 10.5, 14 10.2, 11 10.2 C 8 10.2, 5.6 10.6, 4 11.4 C 3.4 10.8, 3.4 10.4, 4 10 Z" />
      <circle cx="4.5" cy="10.7" r="0.5" fill="var(--paper, #FFFBF1)" />
    </svg>
  );
}

/* ─── LOCOMATE MASCOT — Map markers + Logo ────────────────────────────── */

export interface MascotProps extends BrandIconProps {
  /** When true, only the head + antlers render (no lower body silhouette).
   *  Useful for small favicon-sized contexts. */
  bust?: boolean;
}

export function LocomateMascot({ bust, ...props }: MascotProps) {
  const viewBox = bust ? "368 86 334 250" : "368 86 334 394";
  return (
    <svg
      {...iconProps(props)}
      viewBox={viewBox}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M518.2,163c-80.2,0-145.2,65-145.2,145.2c0,51.7,27,97,67.7,122.8 c2.4,1.5,4.8,3,7.3,4.3 c1.1,0.6,2.2,1.2,3.3,1.8c25,14.1,41.8,40.9,41.8,71.7c0,0.5,0,1,0,1.4c0.1,0,0.1,0,0.2,0c0.1,0,0.2,0,0.4,0 c1.5-20.3,6.9-39.6,15.4-57.1c2.7-5.6,5.8-11,9.2-16.2c5.3-8.1,11.3-15.8,17.9-22.8c-5.8,1-11.8,1.5-17.9,1.5 c-59.3,0-107.4-48.1-107.4-107.4c0-59.3,48.1-107.4,107.4-107.4c59.3,0,107.4,48.1,107.4,107.4c0,23.8-7.7,45.8-20.8,63.6 c-6.5,8.8-14.2,16.5-23,23c-3.4,2.1-6.8,4.3-10.1,6.6c-19.1,13.6-35.1,31.3-46.6,51.8c-2.5,4.5-4.8,9.1-6.9,13.8 c-6.8,15.5-11.2,32.2-12.7,49.8c-0.4,4.6-0.6,9.2-0.6,13.9c0,2.2,0.1,4.3,0.1,6.5c4.4-0.2,8.8-0.4,13.2-0.4 c7.8,0,15.5,0.4,23.1,1.1c1.5-44.7,23.9-84.1,57.6-108.8l-0.7,0.2c21.2-14,38.5-33.5,50-56.4c1.3-2.5,2.5-5.1,3.6-7.7 c7.5-17.5,11.6-36.8,11.6-57C663.4,228,598.4,163,518.2,163z" />
      <path
        fill="var(--paper, #FFFBF1)"
        d="M580.5,226.8c51.7,28,103.4,40.6,139.1,36.5l6.4,12.9c-39-2.7-90.7-19.3-142.9-48 C582.2,227.8,581.3,227.3,580.5,226.8z"
      />
      <path
        fill="var(--paper, #FFFBF1)"
        d="M700.2,224.5c-34.4-5.2-73.7-18.6-112.5-40c-1.6-0.9-3.1-1.7-4.7-2.6c40.4,21.5,80.9,33.2,113.1,34.3 L700.2,224.5z"
      />
      <g>
        <path d="M547.6,206.8c10.4,6.9,21.3,13.6,32.8,20c-0.7-0.4-1.5-0.8-2.2-1.2C567.4,219.7,557.2,213.4,547.6,206.8z" />
        <path d="M454.5,114.9c14.9,28.6,48.3,62,93.1,91.9c9.6,6.6,19.8,12.9,30.6,18.8c0.7,0.4,1.5,0.8,2.2,1.2 c0.9,0.5,1.7,1,2.6,1.4c52.2,28.7,103.9,45.3,142.9,48l28.5,57.2c-57.7-6.9-132.3-32.4-207.9-74.1c-75.6-41.6-137.1-91-173.8-136 L454.5,114.9z" />
        <path d="M547.6,206.8c-44.9-29.9-78.3-63.3-93.1-91.9l11.2-1.2C474.5,142.7,504.5,177.3,547.6,206.8z" />
        <path d="M465.7,113.8L493,111c19.5,24.2,49.3,48.7,85.6,68.7c1.4,0.8,2.9,1.6,4.3,2.3c1.5,0.9,3.1,1.8,4.7,2.6 c38.9,21.4,78.1,34.8,112.5,40l19.3,38.8c-35.6,4.1-87.4-8.6-139.1-36.5c-11.5-6.4-22.5-13.1-32.8-20 C504.5,177.3,474.5,142.7,465.7,113.8z" />
        <path d="M493,111l0.7-0.1c21.8,25.2,52.5,50.2,89.3,71.1c-1.4-0.8-2.9-1.5-4.3-2.3C542.3,159.6,512.6,135.1,493,111z" />
        <path d="M636.3,96.2l59.8,120.1c-32.2-1.1-72.7-12.8-113.1-34.3c-36.8-20.9-67.4-45.8-89.3-71.1L636.3,96.2z" />
      </g>
      <ellipse cx="455.5" cy="291.5" rx="12.4" ry="17.8" />
      <circle fill="var(--paper, #FFFBF1)" cx="458.3" cy="282.4" r="4.7" />
      <ellipse cx="537.4" cy="295.9" rx="12.4" ry="17.8" />
      <circle fill="var(--paper, #FFFBF1)" cx="540.2" cy="286.8" r="4.7" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={3.48}
        strokeMiterlimit={10}
        d="M490.3,304.5c0,0-15,11.3,0,21.6"
      />
    </svg>
  );
}

/* ─── MAP MARKER — Map pins ──────────────────────────────────────────── */

/**
 * The compact mascot variant — same antlered creature as the main logo,
 * but smaller, with an "L" letter embedded inside as identification (for
 * map-pin use). Lifted from `/Bộ Nhận Diện/Logo/lo co-5/map.svg`.
 *
 * Use this for map markers, list-item locator badges, and any context
 * where the brand needs to identify a location at small size.
 */
export function MapMarker(props: BrandIconProps) {
  return (
    <svg
      {...iconProps(props)}
      viewBox="370 95 980 1320"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer creature + body silhouette */}
      <path d="M 1291.539062 502.820312 L 1123.945312 381.25 L 1101.371094 364.753906 L 1045.796875 323.941406 L 1044.058594 323.070312 L 751.425781 110.324219 L 477.894531 309.179688 C 531.730469 337.832031 602.066406 358.675781 681.957031 367.359375 C 678.484375 368.226562 674.140625 368.226562 670.667969 369.09375 C 591.648438 362.148438 519.574219 345.648438 458.789062 322.203125 L 370.21875 386.460938 C 404.085938 411.644531 449.238281 432.484375 502.207031 448.113281 C 498.734375 450.71875 495.261719 453.324219 491.789062 456.796875 C 433.609375 444.640625 382.375 428.140625 340.695312 408.171875 L 210.441406 502.820312 C 266.015625 526.265625 332.011719 546.238281 404.953125 561 C 371.085938 620.046875 351.113281 688.648438 351.113281 761.589844 C 351.113281 904 425.792969 1029.039062 537.808594 1100.246094 C 544.757812 1104.585938 550.835938 1108.0625 557.78125 1112.402344 C 561.253906 1114.140625 563.859375 1115.875 566.464844 1117.613281 C 635.066406 1156.6875 681.957031 1230.496094 681.957031 1315.597656 C 681.957031 1317.332031 681.957031 1318.199219 681.957031 1319.9375 C 681.957031 1319.9375 682.824219 1319.9375 682.824219 1319.9375 C 687.164062 1263.496094 701.925781 1210.527344 725.375 1162.765625 C 733.1875 1147.136719 741.003906 1132.375 750.554688 1118.480469 C 765.316406 1095.902344 781.816406 1075.0625 800.050781 1055.960938 C 783.550781 1058.566406 767.054688 1060.300781 750.554688 1060.300781 C 586.4375 1060.300781 454.449219 927.445312 454.449219 764.195312 C 454.449219 695.59375 477.894531 633.074219 516.96875 582.707031 C 589.910156 592.261719 668.0625 597.472656 749.6875 597.472656 C 832.179688 597.472656 911.199219 592.261719 985.011719 582.707031 C 1024.085938 633.074219 1047.53125 696.460938 1047.53125 764.195312 C 1047.53125 830.1875 1025.824219 890.972656 990.21875 939.601562 C 971.984375 963.914062 951.144531 985.625 926.832031 1002.992188 C 917.28125 1009.070312 907.726562 1015.148438 899.042969 1021.226562 C 846.074219 1058.566406 801.789062 1107.191406 770.527344 1164.503906 C 763.582031 1176.660156 757.503906 1189.6875 751.425781 1202.710938 C 732.320312 1245.261719 720.164062 1292.152344 716.691406 1339.910156 C 715.820312 1352.933594 714.953125 1365.09375 714.953125 1378.117188 C 714.953125 1384.195312 714.953125 1390.273438 714.953125 1396.351562 C 727.109375 1395.484375 739.265625 1395.484375 751.425781 1395.484375 C 773.132812 1395.484375 793.972656 1396.351562 814.8125 1398.957031 C 819.15625 1275.652344 880.808594 1167.109375 973.722656 1098.507812 L 971.984375 1099.378906 C 1030.164062 1060.300781 1077.921875 1006.464844 1110.050781 943.941406 C 1113.527344 936.996094 1117 930.050781 1119.605469 922.234375 C 1140.445312 873.605469 1151.734375 820.636719 1151.734375 765.0625 C 1151.734375 692.121094 1131.761719 623.523438 1097.894531 564.472656 C 1171.707031 546.238281 1236.832031 526.265625 1291.539062 502.820312 Z" />
      {/* Left eye */}
      <path d="M 632.460938 670.410156 C 632.460938 696.460938 611.621094 717.300781 585.570312 717.300781 C 559.519531 717.300781 538.679688 696.460938 538.679688 670.410156 C 538.679688 644.359375 559.519531 623.523438 585.570312 623.523438 C 611.621094 623.523438 632.460938 644.359375 632.460938 670.410156 Z" />
      <ellipse cx="585.6" cy="664.3" rx="13.3" ry="13.3" fill="var(--paper, #FFFBF1)" />
      {/* Right eye */}
      <path d="M 906.859375 670.410156 C 906.859375 696.460938 886.019531 717.300781 859.96875 717.300781 C 833.917969 717.300781 813.078125 696.460938 813.078125 670.410156 C 813.078125 644.359375 833.917969 623.523438 859.96875 623.523438 C 886.019531 623.523438 906.859375 644.359375 906.859375 670.410156 Z" />
      <ellipse cx="859.9" cy="664.3" rx="13.3" ry="13.3" fill="var(--paper, #FFFBF1)" />
      {/* Embedded "L" letter — brand identifier inside the body */}
      <g transform="translate(717.5, 785.3)">
        <path d="M 43.4 -88.6 L 29.2 -86.9 L 29.2 -5.9 L 47.3 -5.9 C 57.1 -5.9 64.3 -6.4 68.9 -7.3 L 73.2 -26.5 L 77.6 -26.5 L 76.4 0 L 4.1 0 L 4.1 -3.6 L 15.9 -5.5 L 15.9 -86.9 L 4.1 -88.6 L 4.1 -92.3 L 43.4 -92.3 Z" />
      </g>
    </svg>
  );
}

/* ─── CART — Design team's name for the Basket icon ──────────────────── */

/** Alias of `Basket`. The design team calls it "cart" in the official
 *  brand pack (see `/Bộ Nhận Diện/Logo/lo co-5/cart.svg`). New code
 *  should prefer `Cart`; `Basket` stays exported for back-compat. */
export const Cart = Basket;

/* ─── LOGO WITH TEXT — Full lockup ───────────────────────────────────── */

/**
 * The official mascot + wordmark lockup as the design team delivered
 * it (vertical composition — mascot on top, wordmark below). Served as
 * a static SVG so the custom font + kerning is preserved pixel-for-
 * pixel.
 *
 * Use on marketing surfaces (landing page hero, register / login,
 * welcome, footer). For in-product surfaces where mascot + wordmark
 * should sit on a single horizontal line, prefer `<LogoLockup>` below.
 *
 * Variants: the source file uses brick-on-transparent. Pass
 * `variant="ondark"` to flip its color via a CSS filter for use on
 * dark surfaces (forest, brick) — the filter inverts the brick to
 * parchment without changing the original asset.
 */
export function LogoWithText({
  variant,
  className,
  alt = "Locomate",
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** Legacy override. When unset (default) the component auto-swaps to
   *  the parchment SVG under `.dark`. Pass `"ondark"` to force the
   *  parchment asset regardless of theme (e.g. when rendered atop a
   *  forest-toned hero in light mode). `"default"` forces the brick asset. */
  variant?: "default" | "ondark";
}) {
  if (variant === "ondark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/logo-with-text-dark.svg"
        alt={alt}
        className={className}
        {...rest}
      />
    );
  }
  if (variant === "default") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/logo-with-text.svg"
        alt={alt}
        className={className}
        {...rest}
      />
    );
  }
  // Auto theme: render both, let Tailwind's `dark:` variant pick. Same
  // pattern the horizontal `LogoLockup` uses — designed assets per
  // mode beat CSS filters every time.
  const dualClass = cn(className);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-with-text.svg"
        alt={alt}
        className={cn(dualClass, "dark:hidden")}
        {...rest}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-with-text-dark.svg"
        alt={alt}
        className={cn(dualClass, "hidden dark:block")}
        {...rest}
      />
    </>
  );
}

/* ─── LOGO LOCKUP — Horizontal mascot + wordmark ─────────────────────── */

/**
 * Horizontal Locomate lockup. A single composed SVG
 * (`/brand/logo-with-text-horizontal.svg`) embeds the mascot on the
 * left and the wordmark on the right with proportions baked in:
 *
 *   ─ Mascot fills the full lockup height (970×1000 cell, aspect 0.97).
 *   ─ Wordmark sits at 50% height, vertically centred, with a small
 *     gap. Composed file is 3075×1000 → ~3.075:1 aspect.
 *
 * Earlier iterations tried to align two separate <img>s via CSS heights,
 * but the source SVGs each pad ~80% whitespace inside a 1500×1500
 * canvas, making manual alignment brittle. The composed file removes
 * that whole class of problem — sizing is now just "set a height".
 *
 * Dark mode swaps to `/brand/logo-with-text-horizontal-dark.svg`,
 * a pre-coloured parchment variant. No CSS filter — both colour modes
 * are designed assets.
 *
 * This is the ONE canonical lockup — the previous `LogoFull` (which
 * paired a brick-tile mascot box with an SVG-rendered wordmark) was
 * retired in favor of this single composed asset. Auth pages, the
 * loading screen, and the in-app top bar all render `<LogoLockup>`.
 *
 * Sizes (lockup HEIGHT; width follows the 3.075 aspect):
 *   sm   36 px tall · ≈ 111 px wide  — top bar / list-item brand row
 *   md   48 px tall · ≈ 148 px wide  — page header / auth card
 *   lg   72 px tall · ≈ 222 px wide  — loading screen / brand billboard
 *   xl   108 px tall · ≈ 332 px wide — marketing hero
 */
export function LogoLockup({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const heights = {
    sm: "h-9",
    md: "h-12",
    lg: "h-[72px]",
    xl: "h-[108px]",
  } as const;
  const h = heights[size];
  return (
    <span
      className={cn("inline-flex items-center", className)}
      aria-label="Locomate"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-with-text-horizontal.svg"
        alt="Locomate"
        className={cn(h, "w-auto dark:hidden")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-with-text-horizontal-dark.svg"
        alt="Locomate"
        className={cn(h, "w-auto hidden dark:block")}
      />
    </span>
  );
}
