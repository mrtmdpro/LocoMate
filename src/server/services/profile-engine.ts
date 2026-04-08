import type { OnboardingInput } from "@/lib/validations/auth";

interface DerivedProfile {
  personality: Record<string, number>;
  behavior: Record<string, number>;
  emotional: Record<string, number>;
  personalityLabel: string;
}

export function computeDerivedProfile(data: OnboardingInput): DerivedProfile {
  const hasIntent = (v: string) => data.intent.includes(v);
  const styleExplore = data.style.chill_explore;
  const styleSpontaneous = data.style.plan_spontaneous;

  const extroversion = data.social_preference === "meet_new" ? 0.7 : data.social_preference === "group" ? 0.8 : 0.3;
  const curiosity = styleExplore * 0.6 + (hasIntent("Explore Culture") || hasIntent("culture") ? 0.3 : 0) + (data.interests.length / 8) * 0.1;
  const energy = clamp(styleExplore * 0.8 + (data.time_preference.includes("late_night") ? 0.2 : 0));
  const depth = clamp(hasIntent("Explore Culture") || hasIntent("culture") ? 0.8 : hasIntent("Food & Drink") || hasIntent("food") ? 0.6 : 0.4);
  const planning = clamp(1 - styleSpontaneous);
  const flexibility = clamp(styleSpontaneous * 0.7 + styleExplore * 0.3);
  const relaxation = clamp(1 - styleExplore);
  const socialWeight = clamp(extroversion * 0.8);
  const explorationWeight = clamp(styleExplore);
  const novelty = clamp(curiosity * 0.9);

  const personality = {
    extroversion: clamp(extroversion),
    planning,
    curiosity: clamp(curiosity),
    flexibility,
    depth,
    energy,
  };

  const behavior = {
    spending_pattern: data.budget === "high" ? 0.8 : data.budget === "medium" ? 0.5 : 0.2,
    decision_speed: clamp(styleSpontaneous * 0.8),
    edit_frequency: clamp(1 - styleSpontaneous) * 0.5,
    exploration_pattern: clamp(styleExplore),
    risk_behavior: clamp(styleExplore * 0.5 + styleSpontaneous * 0.3),
    mobility_preference: clamp(styleExplore * 0.7),
  };

  const emotional = {
    relaxation_weight: relaxation,
    social_weight: socialWeight,
    exploration_weight: explorationWeight,
    inspiration_weight: clamp(hasIntent("Explore Culture") || hasIntent("culture") ? 0.7 : 0.4),
    escapism_weight: clamp(hasIntent("Adventure") || hasIntent("adventure") ? 0.7 : 0.4),
    novelty_seeking: novelty,
  };

  const personalityLabel = computePersonalityLabel(personality, emotional);

  return { personality, behavior, emotional, personalityLabel };
}

function computePersonalityLabel(
  p: Record<string, number>,
  e: Record<string, number>
): string {
  if (p.curiosity >= 0.7 && p.depth >= 0.7) return "The Deep Explorer";
  if (p.extroversion >= 0.7 && e.social_weight >= 0.5) return "The Social Butterfly";
  if (p.energy >= 0.7 && e.exploration_weight >= 0.6) return "The Thrill Seeker";
  if (p.planning >= 0.6 && p.depth >= 0.6) return "The Culture Scholar";
  if (e.relaxation_weight >= 0.6 && p.energy <= 0.4) return "The Zen Wanderer";
  if (e.novelty_seeking >= 0.5 && p.flexibility >= 0.6) return "The Spontaneous Spirit";
  if (p.curiosity >= 0.5 && p.flexibility >= 0.5) return "The Curious Nomad";
  if (e.exploration_weight >= 0.5) return "The Urban Discoverer";
  return "The Hanoi Adventurer";
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, Number(v.toFixed(2))));
}
