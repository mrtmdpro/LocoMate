import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BrandTagTone =
  | "fixed"
  | "flexible"
  | "workshop"
  | "esim"
  | "merch"
  | "guide"
  | "ai";

/**
 * Small categorical tag in the Locomate brand language. Wraps the shadcn
 * Badge so the surface API is consistent with the rest of the design
 * system, but enforces brand tones only — feature surfaces should not be
 * picking arbitrary `<Badge>` variants.
 *
 * Rules (see design-system canvas §05):
 *   - Each rail / add-on owns one tone.
 *   - Stack a maximum of three tags on a card.
 *   - The `ai` tone is always ink-on-cream — it is a label, not a category.
 */
export function BrandTag({
  tone,
  children,
  className,
  ...props
}: { tone: BrandTagTone; children: React.ReactNode; className?: string } & Omit<
  React.ComponentProps<typeof Badge>,
  "variant"
>) {
  return (
    <Badge variant={tone} className={cn(className)} {...props}>
      {children}
    </Badge>
  );
}
