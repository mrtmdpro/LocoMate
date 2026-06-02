"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

interface Props {
  // Inputs describing the thing we're explaining. We try to match the user's
  // derivedData (travel personality) against the content's tags/category to
  // emit 2-3 human-readable reasons.
  itemKind: "experience" | "activity";
  itemTitle: string;
  itemCategory: string | null | undefined;
  itemHighlights?: string[] | null;
  // Optional extras that strengthen an explanation.
  authorLanguages?: string[] | null;
}

/**
 * Post-pivot repositioning of "AI matching": instead of generating itineraries,
 * the AI simply EXPLAINS why the viewer likely fits a given tour/activity.
 * No LLM calls; the rules engine reads the viewer's `userProfile.derivedData`
 * travel-personality tags and surfaces the top 2-3 reasons.
 *
 * Rendered below the primary card on experience + activity detail pages.
 * Hides silently if the viewer is anonymous or has no profile data yet --
 * the product still works, they just don't see the explainer.
 */
export function AiExplainer({ itemKind, itemTitle, itemCategory, itemHighlights, authorLanguages }: Props) {
  const { user } = useAuthStore();
  const { data: profile } = trpc.user.getProfile.useQuery(undefined, { enabled: !!user });

  if (!user || !profile) return null;

  // derivedData is computed by computeDerivedProfile (see services/profile-engine).
  // Shape: { topInterests: string[], adventurousness: number, ... }
  const derived = (profile.profile?.derivedData ?? null) as {
    topInterests?: string[];
    adventurousness?: number;
    socialScore?: number;
    budgetTier?: string;
    travelPersonality?: string;
  } | null;

  const explicit = (profile.profile?.explicitData ?? null) as {
    interests?: string[];
    intent?: string[];
    budget?: string;
    social_preference?: string;
    time_preference?: string[];
  } | null;

  const reasons: string[] = [];
  const itemCatLower = (itemCategory ?? "").toLowerCase();
  const combinedTags = [
    ...(explicit?.interests ?? []),
    ...(derived?.topInterests ?? []),
  ].map((t) => String(t).toLowerCase());

  // Rule 1: interest keyword match.
  const tagHits = combinedTags.filter((t) => {
    const hay = `${itemTitle} ${itemCategory ?? ""} ${(itemHighlights ?? []).join(" ")}`.toLowerCase();
    return t.length >= 3 && hay.includes(t);
  });
  if (tagHits.length > 0) {
    const top2 = Array.from(new Set(tagHits)).slice(0, 2);
    reasons.push(
      `Matches your interest in ${top2.map((t) => capitalize(t)).join(" and ")}.`,
    );
  }

  // Rule 2: category alignment with intent keywords.
  const intentTags = (explicit?.intent ?? []).map((t) => String(t).toLowerCase());
  if (itemCatLower === "culinary" || itemCatLower === "food") {
    if (intentTags.some((t) => t.includes("food"))) {
      reasons.push("You told us food is a priority on this trip.");
    }
  } else if (itemCatLower === "cultural" || itemCatLower === "art" || itemCatLower === "tour_lite") {
    if (intentTags.some((t) => t.includes("culture") || t.includes("heritage"))) {
      reasons.push("You flagged culture and heritage as high-priority.");
    }
  } else if (itemCatLower === "adventure" || itemCatLower === "performance") {
    if (derived?.adventurousness && derived.adventurousness > 0.6) {
      reasons.push("Your adventurousness score suggests you'll enjoy this.");
    }
  } else if (itemCatLower === "workshop" || itemCatLower === "class") {
    if (intentTags.some((t) => t.includes("learn") || t.includes("craft"))) {
      reasons.push("Hands-on learning aligns with what you told us.");
    }
  }

  // Rule 3: language match.
  if (Array.isArray(authorLanguages) && authorLanguages.length > 0) {
    const hostLangs = authorLanguages.map((l) => String(l).toLowerCase());
    if (hostLangs.includes("english")) {
      // Generic traveler signal; we don't know the user's preferred language
      // in MVP, so frame this as a host-side fact rather than a match claim.
      reasons.push(`Host speaks ${authorLanguages.slice(0, 2).join(" and ")}.`);
    }
  }

  // Hide the card entirely if we have nothing specific to say. Empty filler
  // would feel like slop.
  if (reasons.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-[#faf6ec] to-white">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-bold">✓</span>
          <p className="text-sm font-semibold text-secondary">Why this {itemKind === "experience" ? "tour" : "activity"} fits you</p>
        </div>
        <ul className="space-y-1 pl-1">
          {reasons.slice(0, 3).map((r, i) => (
            <li key={i} className="text-xs text-secondary/90 flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground pt-1">
          Based on your profile preferences. Update in{" "}
          <Link href="/profile/preferences" className="text-primary font-medium">preferences</Link>.
        </p>
      </CardContent>
    </Card>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
