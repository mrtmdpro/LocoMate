"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HoiVanBand } from "./illustrations";
import type { AiTone } from "@/server/services/llm-types";

/**
 * Phase A.8 — Italic-serif chat surface for the personality quiz.
 *
 * Streams a single AI message in (token-by-token via the
 * `/api/chat/quiz` SSE endpoint), then renders the picker chips. When a
 * user picks an answer, the parent's `onAnswer` is called and the chat
 * scrolls to the next question — which the parent supplies via the
 * `messages` array.
 *
 * The component is pure UI: no message storage, no scoring. The parent
 * (/onboarding/chat) owns the conversation state.
 */

export type AiChatMessage =
  | {
      kind: "ai";
      id: string;
      /** Markdown-light text — newlines respected, no inline HTML. */
      text: string;
      /** When set, the answer chips render under the message. The
       *  picker is hidden once `pickedId` is set. */
      answers?: { id: string; label: string; sub?: string }[];
      pickedId?: string;
    }
  | {
      kind: "user";
      id: string;
      text: string;
    };

export function AiChat({
  messages,
  streamingMessageId,
  onAnswer,
  tone,
}: {
  messages: AiChatMessage[];
  /** When non-null, the AI message with that id is currently streaming
   *  (renders a tiny pulsing dot at the end). */
  streamingMessageId: string | null;
  onAnswer: (messageId: string, answerId: string) => void;
  tone?: AiTone;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Keep the last message in view as new chunks land. Use a layout
  // effect-style behaviour but in useEffect so SSR doesn't choke.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingMessageId]);

  return (
    <div className="flex flex-col rounded-lg overflow-hidden bg-card border border-foreground/12">
      <div
        ref={scrollRef}
        className="flex flex-col gap-4 p-5 lg:p-6 overflow-y-auto max-h-[60vh] min-h-[24rem]"
      >
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            streaming={m.kind === "ai" && streamingMessageId === m.id}
            onAnswer={(answerId) => onAnswer(m.id, answerId)}
            tone={tone}
          />
        ))}
      </div>
      <HoiVanBand width={420} height={20} opacity={0.5} className="block w-full" />
    </div>
  );
}

function ChatBubble({
  message,
  streaming,
  onAnswer,
  tone,
}: {
  message: AiChatMessage;
  streaming: boolean;
  onAnswer: (answerId: string) => void;
  tone?: AiTone;
}) {
  if (message.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5">
          <p className="text-sm leading-relaxed">{message.text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 max-w-[88%]">
      <div className="rounded-2xl rounded-bl-md bg-paper border border-foreground/10 px-4 py-3">
        <p className="font-serif italic text-base lg:text-lg leading-relaxed text-foreground">
          {message.text}
          {streaming && <StreamCursor />}
        </p>
        {tone && (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground/70 font-mono">
            {toneLabel(tone)}
          </p>
        )}
      </div>
      {message.answers && !message.pickedId && (
        <div className="flex flex-wrap gap-2">
          {message.answers.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid="quiz-answer"
              onClick={() => onAnswer(a.id)}
              className={cn(
                "group flex flex-col items-start gap-0.5 rounded-md border px-4 py-2.5",
                "border-foreground/15 bg-card hover:bg-muted hover:border-secondary/40 transition-colors text-left",
              )}
              disabled={streaming}
            >
              <span className="text-sm font-semibold leading-tight text-foreground">
                {a.label}
              </span>
              {a.sub && (
                <span className="text-xs text-muted-foreground">{a.sub}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {message.answers && message.pickedId && (
        <div className="flex">
          <div className="bg-secondary/15 text-secondary dark:text-foreground border border-secondary/30 rounded-full px-3 py-1 text-xs font-medium">
            Đã chọn:{" "}
            {message.answers.find((a) => a.id === message.pickedId)?.label}
          </div>
        </div>
      )}
    </div>
  );
}

function StreamCursor() {
  return (
    <span
      aria-hidden
      className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-foreground/70 animate-pulse"
    />
  );
}

function toneLabel(tone: AiTone): string {
  switch (tone) {
    case "thu-thi":
      return "Thủ thỉ tâm tình";
    case "hom-hinh":
      return "Hóm hỉnh lém lỉnh";
    case "truc-dien":
      return "Trực diện nhanh gọn";
  }
}

/**
 * Helper: streams a question from `/api/chat/quiz` and pumps chunks into
 * the provided callbacks. Returns the assembled text on success, throws
 * on transport failure. The component using this should manage the
 * "streaming" state and accumulate `text`.
 */
export async function streamQuizQuestion({
  questionId,
  questionPrompt,
  nickname,
  tone,
  onChunk,
  authToken,
  signal,
}: {
  questionId: string;
  questionPrompt: string;
  nickname?: string;
  tone?: AiTone;
  onChunk: (chunk: string) => void;
  authToken?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch("/api/chat/quiz", {
    method: "POST",
    // Carry the httpOnly access cookie so the quiz can personalise for a
    // signed-in user. `authToken` remains an optional legacy Bearer override.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ questionId, questionPrompt, nickname, tone }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Quiz stream failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE parser — events are separated by blank lines.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const ev of events) {
      const line = ev.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      try {
        const parsed = JSON.parse(json) as {
          chunk?: string;
          done?: boolean;
          error?: string;
        };
        if (parsed.chunk) {
          onChunk(parsed.chunk);
          assembled += parsed.chunk;
        }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.done) return assembled;
      } catch {
        // Ignore malformed events; the next valid one wins.
      }
    }
  }
  return assembled;
}
