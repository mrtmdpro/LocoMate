import * as React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandTag, type BrandTagTone } from "./brand-tag";

export type TourCardVariant = "fixed" | "flexible";

export type TourCardProps = {
  variant: TourCardVariant;
  /** Stacked above the title. Passed straight through (mark up Vietnamese
   *  diacritics inline if you need them). */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Bold price label rendered in italic display serif. e.g. "480k" or
   *  "220k → 1.2M". The currency / "from" copy lives in `priceCaption`. */
  price: React.ReactNode;
  priceCaption?: React.ReactNode;
  /** Eyebrow shown above the price block. Defaults to "From" for fixed
   *  tours and "Today's range" for flexible. */
  priceEyebrow?: string;
  tags?: { tone: BrandTagTone; label: React.ReactNode }[];
  /** Up to four `{label, value}` cells rendered under the price block.
   *  Recommended for the fixed variant (length / format / group / locale). */
  meta?: { label: string; value: React.ReactNode }[];
  /** Primary CTA on the card. */
  primaryAction?: { label: React.ReactNode; href?: string; onClick?: () => void };
  secondaryAction?: { label: React.ReactNode; href?: string; onClick?: () => void };
  className?: string;
};

const VARIANT_STYLES: Record<TourCardVariant, { band: string; price: string }> = {
  fixed: { band: "bg-primary", price: "text-brick" },
  flexible: { band: "bg-secondary", price: "text-secondary" },
};

const PRIMARY_VARIANT: Record<TourCardVariant, "default" | "forest"> = {
  fixed: "default",
  flexible: "forest",
};

const DEFAULT_PRICE_EYEBROW: Record<TourCardVariant, string> = {
  fixed: "From",
  flexible: "Today's range",
};

/**
 * Locomate tour-card pattern. Both rails (Fixed / Flexible) share the same
 * structure: 6-px tone band, tags row, italic title, price block, hairline,
 * meta or extra tags, action row.
 *
 * The tone-band colour is the only structural difference between variants;
 * accent text and the primary button colour follow.
 */
export function TourCard({
  variant,
  title,
  subtitle,
  price,
  priceCaption,
  priceEyebrow,
  tags,
  meta,
  primaryAction,
  secondaryAction,
  className,
}: TourCardProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden", className)}>
      <div className={cn("h-1.5", v.band)} />
      <div className="flex flex-col gap-4 bg-paper border border-foreground/12 border-t-0 rounded-b-lg p-6">
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <BrandTag key={i} tone={t.tone}>
                {t.label}
              </BrandTag>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <h3 className="text-h2 font-voice leading-8 text-foreground font-normal">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-eyebrow">
            {priceEyebrow ?? DEFAULT_PRICE_EYEBROW[variant]}
          </span>
          <div className="flex items-end gap-2">
            <span className={cn("font-serif text-4xl leading-[2.25rem]", v.price)}>
              {price}
            </span>
            {priceCaption && (
              <span className="text-xs text-muted-foreground pb-1">{priceCaption}</span>
            )}
          </div>
        </div>

        {meta && meta.length > 0 && (
          <>
            <div className="h-px bg-foreground/10" />
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              {meta.map((m, i) => (
                <div key={i} className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-eyebrow">{m.label}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {primaryAction &&
              (primaryAction.href ? (
                <Link href={primaryAction.href} onClick={primaryAction.onClick}>
                  <Button variant={PRIMARY_VARIANT[variant]} size="brand">
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant={PRIMARY_VARIANT[variant]}
                  size="brand"
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.label}
                </Button>
              ))}
            {secondaryAction &&
              (secondaryAction.href ? (
                <Link href={secondaryAction.href} onClick={secondaryAction.onClick}>
                  <Button variant="link" size="brand">
                    {secondaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button variant="link" size="brand" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
