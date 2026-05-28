import { cn } from "@/lib/utils";
import { HoiVanBand } from "./illustrations";

/**
 * Section break in the Locomate brand. Hairline + hồi-văn band + hairline.
 * Use between major sections of long pages (home, tour detail, design-system
 * showcase). Don't stack two adjacent.
 */
export function HoiVanDivider({
  className,
  bandWidth = 160,
  opacity = 0.45,
}: {
  className?: string;
  bandWidth?: number;
  opacity?: number;
}) {
  return (
    <div className={cn("flex items-center gap-3.5 w-full", className)}>
      {/* Hairline rules are bumped in dark mode -- parchment at 12% on
          deep forest is nearly invisible, 22% reads as a quiet edge. */}
      <span className="flex-1 h-px bg-foreground/12 dark:bg-foreground/22" />
      <HoiVanBand width={bandWidth} height={20} opacity={opacity} />
      <span className="flex-1 h-px bg-foreground/12 dark:bg-foreground/22" />
    </div>
  );
}
