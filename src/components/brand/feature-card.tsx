import * as React from "react";
import { cn } from "@/lib/utils";
import { BrandTag, type BrandTagTone } from "./brand-tag";

export type FeatureCardAccent = "terracotta" | "forest" | "brick";

const ACCENT_BAR: Record<FeatureCardAccent, string> = {
  terracotta: "bg-primary",
  forest: "bg-secondary",
  brick: "bg-brick",
};

/**
 * Feature highlight card. Pairs a quiet hand-drawn motif with one italic
 * title and one specific sentence — the moodboard pattern from canvas §04.
 *
 * The motif tells the user what the feature is *like*; the title tells
 * them what it *does*.
 *
 * @example
 *   <FeatureCard
 *     accent="forest"
 *     illus={<Lotus color={DEFAULT_FOREST} />}
 *     kicker="Flexible Tours"
 *     title="Build your day, conflict-free."
 *     body="Pick attractions and workshops on a shared timeline."
 *     tags={[{ tone: "flexible", label: "Flexible" }]}
 *   />
 */
export function FeatureCard({
  illus,
  kicker,
  title,
  body,
  tags,
  accent = "terracotta",
  className,
}: {
  illus: React.ReactNode;
  kicker: string;
  title: React.ReactNode;
  body: React.ReactNode;
  tags?: { tone: BrandTagTone; label: React.ReactNode }[];
  accent?: FeatureCardAccent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-lg bg-card border border-foreground/12 p-6 sm:min-h-[18rem]",
        className,
      )}
    >
      <span className={cn("absolute top-0 left-6 right-6 h-0.5", ACCENT_BAR[accent])} />
      <div className="h-20 flex items-center">{illus}</div>
      <div className="flex flex-col gap-2">
        <span className="text-eyebrow">{kicker}</span>
        <h3 className="text-h2 font-voice leading-7 text-foreground font-normal">
          {title}
        </h3>
        <p className="text-sm leading-5 text-muted-foreground">{body}</p>
      </div>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {tags.map((t, i) => (
            <BrandTag key={i} tone={t.tone}>
              {t.label}
            </BrandTag>
          ))}
        </div>
      )}
    </div>
  );
}
