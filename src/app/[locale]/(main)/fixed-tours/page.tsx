"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * The PRD names the Fixed Tour hub `/fixed-tours`, but the actual chapter hub
 * shipped at `/experiences` (only `/fixed-tours/[id]` detail pages exist
 * here). Old links to the bare `/fixed-tours` index used to 404; redirect them
 * to the real hub so the route name stops being a dead end. Client-side so the
 * auth wrapper still applies.
 */
export default function FixedToursIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/experiences");
  }, [router]);
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground">Redirecting to Fixed Tours…</p>
    </div>
  );
}
