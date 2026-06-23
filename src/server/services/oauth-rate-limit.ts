import { TRPCError } from "@trpc/server";
import { rateLimit } from "./chat-ratelimit";

export type OAuthRateLimitPhase = "start" | "callback";

export const OAUTH_RATE_LIMIT_WINDOW_SEC = 5 * 60;
export const OAUTH_START_RATE_LIMIT = 20;
export const OAUTH_CALLBACK_RATE_LIMIT = 30;
export const OAUTH_RATE_LIMIT_MESSAGE = "Too many OAuth attempts";

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
}

export function oauthRateLimitKey(phase: OAuthRateLimitPhase, ip: string): string {
  return `oauth:${phase}:${ip}`;
}

export async function enforceOAuthRateLimit(
  request: Request,
  phase: OAuthRateLimitPhase,
): Promise<void> {
  await rateLimit({
    key: oauthRateLimitKey(phase, clientIp(request)),
    limit: phase === "start" ? OAUTH_START_RATE_LIMIT : OAUTH_CALLBACK_RATE_LIMIT,
    windowSec: OAUTH_RATE_LIMIT_WINDOW_SEC,
    message: OAUTH_RATE_LIMIT_MESSAGE,
  });
}

export function isRateLimitError(err: unknown): boolean {
  return err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS";
}

export function oauthRateLimitResponse(): Response {
  return new Response(OAUTH_RATE_LIMIT_MESSAGE, { status: 429 });
}
