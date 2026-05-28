import * as React from "react";

/**
 * "Where this motif goes" cell, used on the in-app design-system showcase
 * to teach designers how the illustration library applies in product.
 * Carries: a motif preview, a short title, and one rule sentence.
 */
export function ApplicationNote({
  illus,
  title,
  body,
}: {
  illus: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-20 items-center justify-center rounded-md bg-paper border border-foreground/12 p-2">
        {illus}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs leading-[18px] text-muted-foreground">{body}</span>
      </div>
    </div>
  );
}
