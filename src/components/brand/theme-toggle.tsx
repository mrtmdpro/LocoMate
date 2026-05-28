"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

/**
 * Locomate's two-mode theme toggle — "Nắng Sớm Tràng An" (light) /
 * "Đêm Sâu Phố Cổ" (dark). Pill-shaped, italic-serif labels, brick text
 * on the active half. Renders nothing until mounted to avoid a flash of
 * the wrong active half before next-themes hydrates.
 *
 * On change:
 *   1. next-themes flips the `.dark` class on <html> and writes
 *      localStorage["locomate-theme"].
 *   2. If the user is signed in, we fire the `setThemePref` tRPC mutation
 *      so the choice syncs across devices. Failure is non-blocking — the
 *      local theme still updated.
 */
export function ThemeToggle({
  variant = "default",
  className,
}: {
  /** `default` is the compact pill used in the topbar. `row` is a full-width
   *  labelled row for settings pages. */
  variant?: "default" | "row";
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const setThemePref = trpc.user.setThemePref.useMutation();
  const t = useTranslations("themeToggle");

  // next-themes hydrates client-side; pre-hydration the `theme` value can
  // diverge from what the user actually has, so we wait one render before
  // showing the active state. The container still occupies space so the
  // topbar layout doesn't shift.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handle = (next: "light" | "dark") => {
    setTheme(next);
    if (user) {
      setThemePref.mutate({ theme: next });
    }
  };

  const isDark = mounted && theme === "dark";

  if (variant === "row") {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 gap-4 flex-wrap",
          className,
        )}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-eyebrow">{t("eyebrow")}</span>
          <span className="font-serif italic text-base text-foreground leading-snug">
            {isDark ? t("themeDark") : t("themeLight")}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">
            {isDark ? t("descDark") : t("descLight")}
          </span>
        </div>
        <ToggleControl
          mounted={mounted}
          isDark={isDark}
          onSelect={handle}
          srLight={t("srLight")}
          srDark={t("srDark")}
          labelLight={t("modeLight")}
          labelDark={t("modeDark")}
          ariaLabel={t("controlAria")}
        />
      </div>
    );
  }

  return (
    <ToggleControl
      mounted={mounted}
      isDark={isDark}
      onSelect={handle}
      className={className}
      srLight={t("srLight")}
      srDark={t("srDark")}
      labelLight={t("modeLight")}
      labelDark={t("modeDark")}
      ariaLabel={t("controlAria")}
    />
  );
}

function ToggleControl({
  mounted,
  isDark,
  onSelect,
  className,
  srLight,
  srDark,
  labelLight,
  labelDark,
  ariaLabel,
}: {
  mounted: boolean;
  isDark: boolean;
  onSelect: (next: "light" | "dark") => void;
  className?: string;
  srLight: string;
  srDark: string;
  labelLight: string;
  labelDark: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center bg-card border border-foreground/14 rounded-full p-0.5 gap-0.5",
        className,
      )}
    >
      <ModeButton
        active={mounted && !isDark}
        pristine={!mounted}
        onClick={() => onSelect("light")}
        label={labelLight}
        srLabel={srLight}
      >
        <SunGlyph className="w-3.5 h-3.5" />
      </ModeButton>
      <ModeButton
        active={mounted && isDark}
        pristine={!mounted}
        onClick={() => onSelect("dark")}
        label={labelDark}
        srLabel={srDark}
      >
        <MoonGlyph className="w-3.5 h-3.5" />
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  pristine,
  onClick,
  label,
  srLabel,
  children,
}: {
  active: boolean;
  pristine: boolean;
  onClick: () => void;
  label: string;
  srLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={srLabel}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full transition-colors text-xs font-semibold",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
        pristine && "opacity-70",
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function SunGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      className={className}
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M3.3 12.7l1-1M11.7 4.3l1-1" />
    </svg>
  );
}

function MoonGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 100 13 5.5 5.5 0 007-6z" />
    </svg>
  );
}
