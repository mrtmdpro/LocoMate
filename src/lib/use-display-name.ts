"use client";

import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

/**
 * Single source of truth for "what should the app call this user?". The
 * ladder is:
 *
 *   1. `userProfiles.explicitData.nickname` — set by the user on the
 *      onboarding nickname step or on /settings. The brand wants this to
 *      win because it's the user's *chosen* danh xưng.
 *   2. `user.displayName` — the OAuth / signup name. Almost always set.
 *   3. `"Lữ khách"` — universal brand fallback. Means "traveller" in
 *      Vietnamese and works as a placeholder when nothing else is known
 *      (e.g. the chatbot streams before the profile query resolves).
 *
 * Returns both the resolved name AND the first-name slice so greeting
 * surfaces (`Xin chào, {firstName}`) don't have to do their own split.
 * `firstName` is taken from whichever name won the ladder, so a nickname
 * of "Kẻ lữ hành" returns `firstName: "Kẻ"` — preserving the brand voice.
 *
 * Server components / unauthenticated routes should not call this hook;
 * it depends on the tRPC profile query and the auth store, both of which
 * require the auth context.
 */
export function useDisplayName(): {
  /** Full name to address the user by. Never empty. */
  name: string;
  /** First word of `name`, useful for short greetings. Never empty. */
  firstName: string;
  /** Whether the user set a custom nickname (vs the fallback ladder). */
  hasNickname: boolean;
  /** Whether the underlying queries are still loading. The returned
   *  `name` is still safe to render — it'll show the fallback. */
  isLoading: boolean;
} {
  const { user } = useAuthStore();
  const { data, isLoading } = trpc.user.getProfile.useQuery(undefined, {
    enabled: !!user,
  });

  const explicit = (data?.profile?.explicitData ?? {}) as { nickname?: string };
  const nickname = explicit.nickname?.trim();
  const display = user?.displayName?.trim();

  const name = nickname || display || "Lữ khách";
  const firstName = name.split(/\s+/)[0] ?? "Lữ khách";

  return {
    name,
    firstName,
    hasNickname: !!nickname,
    isLoading,
  };
}
