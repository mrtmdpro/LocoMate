"use client";

import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";

/**
 * Bell-shaped link to /chat with an unread-count indicator. Replaces the
 * Messages tab in the host bottom nav -- host-side messaging is secondary
 * to operations (bookings, earnings, routes), so we demote it into the
 * header chrome rather than the primary nav. Pattern mirrors Airbnb Host
 * and Uber Driver's notification pill.
 *
 * Renders nothing if the chat router is unavailable or the user has no
 * conversations -- no dead bell.
 */
export function MessagesBell() {
  // getConversations already exists and returns the unread-aware list. We
  // reuse it so we don't need to add a dedicated count endpoint just for
  // the bell.
  const { data, isLoading } = trpc.chat.getConversations.useQuery(undefined, {
    // Refetch on focus + every 60s so the badge stays fresh while the host
    // is checking the dashboard between tours.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" aria-hidden />
    );
  }

  // chat.getConversations returns an array of conversations, each with an
  // `unreadCount` (set per-conversation server-side).
  const conversations = (data ?? []) as Array<{ unreadCount?: number }>;
  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);

  return (
    <Link
      href="/chat"
      aria-label={unreadTotal > 0 ? `${unreadTotal} unread messages` : "Messages"}
      className="relative w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:border-primary transition-colors"
    >
      <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
      {unreadTotal > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center"
          aria-hidden
        >
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </span>
      )}
    </Link>
  );
}
