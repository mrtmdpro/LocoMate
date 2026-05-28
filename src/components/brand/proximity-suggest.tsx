"use client";

import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Lotus } from "./illustrations";
import { cn } from "@/lib/utils";

/**
 * Phase A.5 — "vòng tròn vệ tinh". A small fan of hidden-gem suggestions
 * orbiting a chosen place. Calls `place.getNearby`, which sorts by
 * `visitCount ASC` so genuinely lesser-known places surface first.
 *
 * Visually: parchment card stack with a Lotus motif in the top-right at
 * low opacity. Each suggestion is a pill row — name, category, walk
 * estimate. Tapping a row navigates to the place's explore page.
 *
 * Walk time is computed at ~80 m/min (the doc's quoted Hanoi pace) and
 * floored to the nearest minute. Distances over 1.5 km don't come back
 * from the procedure (it caps at `radiusKm`).
 */
export function ProximitySuggest({
  placeId,
  radiusKm = 1.5,
  limit = 5,
  className,
  variant = "card",
}: {
  placeId: string;
  radiusKm?: number;
  limit?: number;
  className?: string;
  /** `card` (default) wraps the suggestions in a parchment Card.
   *  `embedded` returns just the inner list — use when the parent
   *  surface already provides the chrome. */
  variant?: "card" | "embedded";
}) {
  const { data, isLoading } = trpc.place.getNearby.useQuery(
    { placeId, radiusKm, limit },
    { enabled: !!placeId },
  );

  if (isLoading) {
    return (
      <Wrapper variant={variant} className={className}>
        <div className="animate-pulse space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      </Wrapper>
    );
  }

  const items = data?.nearby ?? [];
  if (items.length === 0) {
    return (
      <Wrapper variant={variant} className={className}>
        <Header />
        <p className="text-sm text-muted-foreground">
          Không có ngõ ngách nào trong vòng {radiusKm} km. Thử mở rộng bán kính trên trang đặt chỗ.
        </p>
      </Wrapper>
    );
  }

  return (
    <Wrapper variant={variant} className={className}>
      <Header />
      <div className="flex flex-col gap-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/explore/${p.slug || p.id}`}
            className="group flex items-center gap-3 p-3 rounded-md border border-foreground/10 bg-paper hover:bg-muted/60 hover:ring-1 hover:ring-primary/30 transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-secondary/12 flex items-center justify-center shrink-0">
              <Lotus size={28} color="var(--secondary)" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-xs text-brick">{walkMinutes(p.distanceKm)} phút</p>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {p.distanceKm < 1
                  ? `${Math.round(p.distanceKm * 1000)}m`
                  : `${p.distanceKm.toFixed(1)}km`}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground italic">
        Sắp xếp theo độ &ldquo;ẩn mình&rdquo; — chỗ ít người biết hơn lên trước.
      </p>
    </Wrapper>
  );
}

function Header() {
  return (
    <div className="relative flex flex-col gap-0.5">
      <div className="absolute -top-1 -right-1 opacity-[0.16] pointer-events-none">
        <Lotus size={64} color="var(--secondary)" />
      </div>
      <span className="text-eyebrow">Vòng tròn vệ tinh</span>
      <h3 className="text-h3 font-voice text-foreground font-normal">
        Ngõ ngách lân cận.
      </h3>
      <p className="text-xs text-muted-foreground">
        Hidden gems trong vòng đi bộ. Không có trên Google Maps.
      </p>
    </div>
  );
}

function Wrapper({
  variant,
  className,
  children,
}: {
  variant: "card" | "embedded";
  className?: string;
  children: React.ReactNode;
}) {
  if (variant === "embedded") {
    return <div className={cn("flex flex-col gap-3 relative", className)}>{children}</div>;
  }
  return (
    <Card className={className}>
      <CardContent className="p-5 flex flex-col gap-3 relative overflow-hidden">
        {children}
      </CardContent>
    </Card>
  );
}

/** Approximate walking time at ~80 m/min, floor 1 minute. */
function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km * 1000) / 80));
}
