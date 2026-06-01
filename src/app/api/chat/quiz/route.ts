import { verifyToken } from "@/server/middleware/auth";
import { db } from "@/server/db";
import { userProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { llmStream } from "@/server/services/llm";
import type { AiTone } from "@/server/services/llm-types";
import { readExplicitData } from "@/server/lib/profile-shape";
import { ACCESS_COOKIE, readCookie } from "@/server/lib/auth-cookies";
import { rateLimit } from "@/server/services/chat-ratelimit";

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
}

/**
 * Phase A.8 — Streaming endpoint for the personality-quiz chatbot.
 *
 * Posts `{ questionId, questionPrompt, nickname?, tone? }`. Returns a
 * `text/event-stream` body of `data: {"chunk":"…"}` lines. The client
 * (AiChat component) accumulates chunks into a typed message.
 *
 * Why a custom route (not tRPC): tRPC over HTTP doesn't stream cleanly,
 * and the Vercel AI SDK's `streamText` is already designed for SSE
 * responses. In mock mode we stream from `llmStream` which fakes the
 * same delivery rhythm.
 *
 * Auth: optional. Anonymous visitors can take the quiz; we only need an
 * auth header if we want to read the user's saved tone / nickname. The
 * client can also pass `tone` and `nickname` in the body directly.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    questionPrompt?: string;
    questionId?: string;
    nickname?: string;
    tone?: AiTone;
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const promptText = (body.questionPrompt ?? "").toString().slice(0, 500);
  if (!promptText) return new Response("Missing questionPrompt", { status: 400 });

  // The quiz drives an LLM call; cap per-IP so anonymous visitors can't run up
  // the inference bill. Generous since a quiz is ~6 questions.
  try {
    await rateLimit({ key: `quiz:${clientIp(request)}`, limit: 40, windowSec: 60 });
  } catch {
    return new Response("Too many requests", { status: 429 });
  }

  // If we have an authenticated user AND no explicit override, prefer the
  // stored tone + nickname so the question persona is consistent with the
  // user's settings.
  let nickname = (body.nickname ?? "").toString().slice(0, 40) || undefined;
  let tone: AiTone | undefined = body.tone;
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const token = bearer || readCookie(request.headers.get("cookie"), ACCESS_COOKIE) || "";
    if (token) {
      const payload = verifyToken(token);
      if (payload?.userId) {
        const profile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, payload.userId),
        });
        const explicit = readExplicitData(profile?.explicitData);
        if (!nickname) nickname = explicit.nickname?.trim() || undefined;
        if (!tone) tone = explicit.aiTone ?? undefined;
      }
    }
  } catch {
    // Anonymous quiz is OK. Fall through with whatever's in the body.
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of llmStream({
          feature: "personality-quiz",
          prompt: promptText,
          user: { nickname, tone },
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err instanceof Error ? err.message : "stream failed" })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
