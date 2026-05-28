"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Legacy AI tour-builder lived here. Per the Apr 2026 BU pivot (move from
 * AI-generated itineraries to Fixed Tours + a-la-carte Activities), this
 * page now redirects to the Activities catalogue. The day-builder UI lives
 * at `/plan/build` for users who want to lay out their activities on a
 * time ruler after adding them to cart.
 *
 * Old bookmarks hitting /plan will land on /activities instead of 404-ing.
 * Keep the redirect client-side so the auth wrapper still applies.
 */
export default function PlanRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/activities");
  }, [router]);
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-secondary">Redirecting...</p>
        <p className="text-xs text-muted-foreground mt-1">
          We&apos;ve retired the custom-tour builder. Browse activities instead.
        </p>
      </div>
    </div>
  );
}
