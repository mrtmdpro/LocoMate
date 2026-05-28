"use client";

import React from "react";

/**
 * A tiny CSS-keyframes "fireworks" burst — 12 small dots in the Đông
 * Sơn palette radiating outwards from centre over 1.4s, then fading.
 *
 * Used to punctuate moments of arrival on the wrap-up cover + stats
 * pages (the business brief: "có hiệu ứng pháo hoa nhẹ hoặc pop-up mở
 * ra mượt mà"). Pure CSS, no JS animation lib, no Framer Motion — so
 * the bundle cost is zero beyond the component file itself.
 *
 * Replay strategy: the component reads `key` like any React element,
 * so callers pass `key={`fx-${tourId}`}` to ensure a fresh mount on
 * tour change. When the user lands on the wrap-up page again later,
 * React's reconciliation re-mounts the burst because `key` changes,
 * and the keyframe animation runs from the start.
 *
 * The component is `pointer-events-none` and `aria-hidden` so it never
 * intercepts a tap nor announces itself to a screen reader. The
 * fireworks are purely decorative — there is no interactive payload.
 */

interface FireworksBurstProps {
  /** Tunes the burst radius. Default 120px. Set lower for tighter
   *  bursts on narrow surfaces (e.g. mobile letter card). */
  radius?: number;
  /** Optional className for caller layout — usually absolute-positioned
   *  inside a relative parent. */
  className?: string;
}

/**
 * The 12-dot ring. Each dot has its own `--angle` so the keyframe
 * `transform: translate(...)` evaluates to a unique vector. Inline-
 * styled CSS variables keep the animation portable across CSS-in-JS
 * setups; no extra global CSS file required.
 */
const DOT_COUNT = 12;
const DOT_COLOURS = [
  "var(--brick)",
  "var(--primary)",
  "#A8C589", // sage
  "var(--secondary)",
];

export function FireworksBurst({
  radius = 120,
  className,
}: FireworksBurstProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: DOT_COUNT }).map((_, i) => {
        const angle = (i / DOT_COUNT) * Math.PI * 2; // radians
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        const colour = DOT_COLOURS[i % DOT_COLOURS.length];
        // Stagger the start by 0–60ms so the burst feels organic
        // rather than a synchronised salute.
        const delay = (i % 4) * 15;
        return (
          <span
            key={i}
            className="locomate-fx-dot"
            style={{
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
              ["--delay" as string]: `${delay}ms`,
              backgroundColor: colour,
            }}
          />
        );
      })}
      <style>{FX_STYLE}</style>
    </div>
  );
}

// Keyframes live next to the component as a self-contained string so
// we don't pollute global CSS with a one-off effect.
const FX_STYLE = /* css */ `
  .locomate-fx-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    opacity: 0;
    transform: translate(0, 0) scale(0.6);
    animation: locomate-fx-radiate 1400ms ease-out var(--delay, 0ms) forwards;
    box-shadow: 0 0 8px 1px currentColor;
  }
  @keyframes locomate-fx-radiate {
    0% {
      opacity: 0;
      transform: translate(0, 0) scale(0.4);
    }
    15% {
      opacity: 0.95;
      transform: translate(calc(var(--dx) * 0.25), calc(var(--dy) * 0.25)) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), calc(var(--dy) + 12px)) scale(0.55);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .locomate-fx-dot {
      animation: none;
      opacity: 0;
    }
  }
`;
