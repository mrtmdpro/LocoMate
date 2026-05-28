"use client";

import React from "react";

/**
 * Wax-seal-style stamp for the digital thank-you letter. A 56×56
 * circular brick disc with the Locomate icon glyph centred on it,
 * subtle radial inner shadow + texture overlay so it reads as
 * "stamped wax" rather than a generic logo badge.
 *
 * The brief calls for "đóng dấu mộc hoặc logo bo tròn của LÔCOMATE" —
 * this is the digital translation: brick = wax-red, the icon as the
 * impression, soft inner-shadow shading for depth, a tiny rim that
 * suggests the seal's outer edge.
 *
 * Visual structure:
 *   - outer disc       : bg-brick, hint of bevel via inset shadow
 *   - inner texture    : radial gradient stop layer (CSS, no extra
 *                        image) for a non-uniform wax look
 *   - rim ring         : 1px ring slightly darker than the disc, gives
 *                        the impression of an embossed edge
 *   - icon glyph       : the icon-only `/brand/logo-tight.svg` centred
 *                        and recoloured to the brick-on-card pairing
 *                        via mix-blend / CSS filter
 *
 * Pure decoration — pointer-events-none, aria-label drives the
 * accessible name (caller injects the localised string).
 */

interface WaxSealProps {
  /** Accessible label, ideally the localised brand name. Defaults to
   *  "Locomate" so the component is usable without an i18n setup. */
  label?: string;
  /** Disc diameter in pixels. Default 56. The icon scales linearly. */
  size?: number;
  /** Optional className for layout — usually absolute-positioned
   *  inside the letter card. */
  className?: string;
}

export function WaxSeal({
  label = "Locomate",
  size = 56,
  className,
}: WaxSealProps) {
  const inner = Math.round(size * 0.62); // icon glyph at ~62% of disc
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className ?? ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      {/* Outer disc with bevel + radial gradient for "wax" texture.
          The two box-shadows give depth: an outer drop and an inset
          inner-shadow that brightens the top edge. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: "var(--brick)",
          backgroundImage:
            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 65%)",
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.22), inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.18)",
        }}
      />
      {/* Embossed rim ring — 1px just inside the outer edge. */}
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          inset: 3,
          border: "1px solid rgba(0,0,0,0.18)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Icon glyph — invert the source SVG to render light-on-brick
          so we don't need a separate light/dark asset just for this
          component. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-tight.svg"
        alt=""
        aria-hidden="true"
        className="relative"
        style={{
          width: inner,
          height: inner,
          // Invert the dark logo source + slight desaturation so it
          // reads as a creamy impression on the brick wax rather than
          // a high-contrast hot brand mark.
          filter:
            "invert(1) brightness(0.95) sepia(0.15) saturate(0.85) drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
        }}
      />
    </div>
  );
}
