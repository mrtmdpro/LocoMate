"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * Shared sub-page header: a 44×44, screen-reader-labeled back button + title
 * (optional eyebrow + right slot). Replaces the per-page copy-pasted headers
 * whose back buttons were 24px and unlabeled (failed WCAG 2.5.5 tap-target +
 * 4.1.2 name). One component keeps chrome consistent across profile sub-pages.
 */
export function PageHeader({
  title,
  eyebrow,
  right,
  onBack,
}: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  const tCommon = useTranslations("common");
  return (
    <div className="flex items-center gap-1 px-4 pt-4 pb-3">
      <button
        type="button"
        onClick={onBack ?? (() => router.back())}
        aria-label={tCommon("back")}
        className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-col">
        {eyebrow && <span className="text-eyebrow">{eyebrow}</span>}
        <h1 className="truncate text-lg font-bold font-heading text-secondary">{title}</h1>
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}
