import * as React from "react";
import { cn } from "@/lib/utils";
import { HoiVanBand } from "./illustrations";

/**
 * Locomate empty-state shell. Watermark illustration in the corner, italic
 * brick title, body copy, action row, optional hồi-văn band as a stamp at
 * the bottom. The composition pattern from canvas §08.
 *
 * Use in: empty trip lists, post-search "no matches", first-run "build a
 * trip" prompts. Don't use as a generic loading state.
 */
export function EmptyState({
  illus,
  eyebrow,
  title,
  body,
  actions,
  showStamp = true,
  className,
}: {
  /** A motif from `@/components/brand/illustrations` rendered around 180px,
   *  positioned in the top-right at 18% opacity behind the content. */
  illus: React.ReactNode;
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Buttons / links rendered in a row at the bottom of the content. */
  actions?: React.ReactNode;
  /** Whether to render the hồi-văn band stamp at the bottom edge. */
  showStamp?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-card border border-foreground/12",
        className,
      )}
    >
      <div className="absolute -right-4 -top-3 opacity-[0.18] pointer-events-none">
        {illus}
      </div>
      <div className="relative flex flex-col items-start gap-4 p-7">
        {eyebrow && <span className="text-eyebrow">{eyebrow}</span>}
        <h2 className="text-h1 font-voice leading-9 text-brick max-w-md font-normal">
          {title}
        </h2>
        {body && (
          <p className="text-sm leading-5 text-muted-foreground max-w-md">{body}</p>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
      </div>
      {showStamp && <HoiVanBand width={420} height={20} opacity={0.5} className="block w-full" />}
    </div>
  );
}
