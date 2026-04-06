import { z } from "zod/v4";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2).max(100),
  role: z.enum(["traveler", "host"]).default("traveler"),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const onboardingSchema = z.object({
  intent: z.array(z.string()).min(1).max(3),
  scenario_choice: z.string(),
  style: z.object({
    chill_explore: z.number().min(0).max(1),
    plan_spontaneous: z.number().min(0).max(1),
  }),
  interests: z.array(z.string()).min(1),
  budget: z.enum(["low", "medium", "high"]),
  social_preference: z.enum(["solo", "meet_new", "group"]),
  time_preference: z.array(z.enum(["morning", "afternoon", "evening", "late_night"])).min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
