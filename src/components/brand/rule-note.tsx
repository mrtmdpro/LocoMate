import * as React from "react";

/**
 * Numbered design rule. Used on the in-app design-system showcase to call
 * out the brand's three illustration rules (one ink weight / brick or
 * forest only / flat, never plastic) and any future rule trios that need
 * the same visual treatment.
 */
export function RuleNote({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-brick tracking-[0.14em]">{n}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <span className="text-xs leading-[18px] text-muted-foreground">{children}</span>
    </div>
  );
}
