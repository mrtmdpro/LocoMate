import type { OnboardingInput } from "@/lib/validations/auth";

interface DerivedProfile {
  personality: Record<string, number>;
  behavior: Record<string, number>;
  emotional: Record<string, number>;
}

export function computeDerivedProfile(data: OnboardingInput): DerivedProfile {
  const hasIntent = (v: string) => data.intent.includes(v);
  const styleExplore = data.style.chill_explore;
  const styleSpontaneous = data.style.plan_spontaneous;

  const extroversion = data.social_preference === "meet_new" ? 0.7 : data.social_preference === "group" ? 0.8 : 0.3;
  const curiosity = styleExplore * 0.6 + (hasIntent("culture") ? 0.3 : 0) + (data.interests.length / 8) * 0.1;

  return {
    personality: {
      extroversion: clamp(extroversion),
      planning: clamp(1 - styleSpontaneous),
      curiosity: clamp(curiosity),
      flexibility: clamp(styleSpontaneous * 0.7 + styleExplore * 0.3),
      depth: clamp(hasIntent("culture") ? 0.8 : hasIntent("food") ? 0.6 : 0.4),
      energy: clamp(styleExplore * 0.8 + (data.time_preference.includes("late_night") ? 0.2 : 0)),
    },
    behavior: {
      spending_pattern: data.budget === "high" ? 0.8 : data.budget === "medium" ? 0.5 : 0.2,
      decision_speed: clamp(styleSpontaneous * 0.8),
      edit_frequency: clamp(1 - styleSpontaneous) * 0.5,
      exploration_pattern: clamp(styleExplore),
      risk_behavior: clamp(styleExplore * 0.5 + styleSpontaneous * 0.3),
      mobility_preference: clamp(styleExplore * 0.7),
    },
    emotional: {
      relaxation_weight: clamp(1 - styleExplore),
      social_weight: clamp(extroversion * 0.8),
      exploration_weight: clamp(styleExplore),
      inspiration_weight: clamp(hasIntent("culture") ? 0.7 : 0.4),
      escapism_weight: clamp(hasIntent("adventure") ? 0.7 : 0.4),
      novelty_seeking: clamp(curiosity * 0.9),
    },
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, Number(v.toFixed(2))));
}
