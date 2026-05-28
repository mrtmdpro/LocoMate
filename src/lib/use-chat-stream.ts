"use client";
import { useEffect, useState } from "react";

/**
 * Subscribe to the chat SSE stream for a given match. Calls `onEvent`
 * for every `event: chat` payload the server emits.
 *
 * Lifecycle:
 *   - Opens an EventSource when the component mounts with a valid
 *     matchId AND the user is authenticated (auth is via cookie; the
 *     server route also accepts Authorization header but EventSource
 *     can't set headers in the browser).
 *   - Auto-reconnects via the native EventSource reconnect behavior
 *     (server hints with `retry: 3000`).
 *   - On error / unmount, closes the connection.
 *
 * Degrades gracefully: if Upstash isn't configured on the server, the
 * stream connects but emits only heartbeats; the component's existing
 * polling (tRPC `refetchInterval`) keeps data fresh. Callers should
 * treat SSE as an enhancement, not a replacement.
 */

export type ChatStreamEvent =
  | { type: "message.new"; message: { id: string; matchId: string } }
  | { type: "message.edited"; id: string; content: string; editedAt: string }
  | { type: "message.deleted"; id: string }
  | { type: "reaction.added"; messageId: string; emoji: string; userId: string }
  | { type: "reaction.removed"; messageId: string; emoji: string; userId: string }
  | { type: "typing.start"; userId: string }
  | { type: "read.advance"; userId: string };

export function useChatStream(
  matchId: string | null | undefined,
  onEvent: (evt: ChatStreamEvent) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!matchId || typeof window === "undefined") return;
    // withCredentials isn't honored uniformly; the server reads the
    // locomate-auth cookie that zustand-persist writes by default.
    const es = new EventSource(`/api/chat/stream/${matchId}`, {
      withCredentials: true,
    });
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("error", () => setConnected(false));
    es.addEventListener("chat", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as ChatStreamEvent;
        onEvent(data);
      } catch {
        // bad payload -- ignore
      }
    });
    return () => {
      es.close();
      setConnected(false);
    };
    // Intentionally depend ONLY on matchId; onEvent is expected to be
    // stable (caller wraps in useCallback or reads latest from a ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return { connected };
}
