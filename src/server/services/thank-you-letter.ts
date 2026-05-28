/**
 * Phase A.6 — Digital Thank-you Letter generator.
 *
 * Two responsibilities:
 *   1. `scheduleThankYouLetter(tx, tourId)` — inserted into the
 *      `thank_you_letters` table with `scheduled_at = now() + 1 hour`
 *      when the tour transitions to `completed`. Idempotent: a unique
 *      constraint on `tour_id` means a second call is a no-op.
 *   2. `renderAndSendDue(db)` — the cron's worker. Reads rows where
 *      `scheduled_at < now() AND sent_at IS NULL`, renders body via the
 *      LLM service (mocked in Phase A), updates `sent_at`. Returns the
 *      number of letters sent.
 *
 * Letter body shape (jsonb):
 *   {
 *     greetingNickname: string,
 *     openingLine: string,    // italic-serif voice
 *     stopsRecap: string[],   // bullets of stop names
 *     signOff: string,        // one of 5 category-aware brand sign-offs
 *     category?: string,      // experiences.category if available
 *   }
 *
 * Storing the rendered body (instead of regenerating on read) means:
 *   - The letter the user sees is the letter we logged.
 *   - Re-rendering won't change canned mocks across redeploys.
 *   - Cost telemetry (Phase C) can attribute exact tokens to a row.
 */

import { eq, isNull, and, lte, sql } from "drizzle-orm";
import { thankYouLetters, tours, userProfiles, experiences } from "../db/schema";
import { llmGenerate } from "./llm";
import type { AiTone } from "./llm-types";
import type { db as PrimaryDb } from "../db";
import { lookupFixedTourCategory } from "../lib/fixed-tour-category";

/**
 * Loose db handle type that accepts both the production `db` export and
 * a transactional Drizzle wrapper. Using the real `typeof db` would
 * over-constrain the tour-router's `ctx.db` (which is a postgres-js
 * adapter), so we widen via a structural type.
 */
type AnyDb = typeof PrimaryDb;

export interface ThankYouLetterBody {
  greetingNickname: string;
  /** Canonical brand opening — template-rendered, not LLM. Carries the
   *  business-brief "hành trình vạn dặm nào cũng bắt đầu từ một bước
   *  chân" phrase verbatim with the nickname interpolated. The /letters
   *  UI renders this first, in italic serif, above the LLM line. */
  brandOpening: string;
  /** LLM-generated post-script line. Mock in Phase A, DeepSeek in Phase
   *  C. Variety knob — `brandOpening` carries the brand promise, this
   *  line carries the colour. */
  openingLine: string;
  stopsRecap: string[];
  signOff: string;
  category?: string;
  /** Wrap-up coupon awarded by tour.completeTour. Optional — when
   *  issuance failed for some reason the letter renders without the
   *  coupon block (graceful degrade) instead of breaking. */
  couponCode?: string;
  couponExpiresAt?: string;
  discountPct?: number;
}

/** Brand sign-offs keyed by Fixed-Tour category. The fourth string is
 *  a fallback for any other category (legacy seeds, host-custom, etc.). */
const CATEGORY_SIGN_OFFS: Record<string, string[]> = {
  "thanh-tao-xu-bac": [
    "Hẹn gặp dưới một mái ngói khác.",
    "Tường rêu phong vẫn ở đó, đợi bạn quay lại.",
  ],
  "hon-dat-nghe-nhan": [
    "Đôi tay đã chạm vào nghề — không quên được nữa.",
    "Nghệ nhân nói lần sau cứ đến, không cần báo trước.",
  ],
  "huong-men-nong-say": [
    "Vị giác là cửa ngõ — và bạn đã mở.",
    "Hà Nội vẫn còn vài món chưa kể cho bạn.",
  ],
  __default__: [
    "Hà Nội ở đây, khi bạn cần một góc.",
    "Hẹn gặp ở chuyến sau, có thể là ngõ khác.",
  ],
};

/**
 * Schedule a thank-you letter for a completed tour. Call from the
 * tour-complete mutation. Safe to call multiple times — the unique
 * constraint on `tour_id` ensures only one letter per tour.
 */
export async function scheduleThankYouLetter(
  db: AnyDb,
  tourId: string,
  userId: string,
  delayMinutes = 60,
): Promise<void> {
  const existing = await db.query.thankYouLetters.findFirst({
    where: eq(thankYouLetters.tourId, tourId),
  });
  if (existing) return;

  const scheduledAt = new Date(Date.now() + delayMinutes * 60_000);
  await db.insert(thankYouLetters).values({
    tourId,
    userId,
    scheduledAt,
    body: { pending: true } as Record<string, unknown>,
  });
}

/**
 * The cron worker. Renders + sends all due letters in a single pass.
 * Returns `{ sent: n }` so the cron route can log to the Vercel UI.
 */
export async function renderAndSendDue(db: AnyDb): Promise<{ sent: number }> {
  const due = await db
    .select()
    .from(thankYouLetters)
    .where(
      and(
        isNull(thankYouLetters.sentAt),
        lte(thankYouLetters.scheduledAt, sql`now()`),
      ),
    )
    .limit(100);

  let sent = 0;
  for (const row of due) {
    try {
      const body = await renderLetterBody(db, row.tourId, row.userId);
      await db
        .update(thankYouLetters)
        .set({ body, sentAt: new Date() })
        .where(eq(thankYouLetters.id, row.id));
      sent += 1;
    } catch (err) {
      // Per-row failure shouldn't block other letters. Log and continue.
      console.error("thank-you letter render failed", { tourId: row.tourId, err });
    }
  }
  return { sent };
}

/**
 * Build the rendered letter body for one tour. Pulls the user's
 * nickname (danh xưng) + the tour's stops + the experience category,
 * then calls the LLM service (mocked in Phase A) for the opening line.
 * Sign-off is selected from `CATEGORY_SIGN_OFFS` deterministically.
 */
export async function renderLetterBody(
  db: AnyDb,
  tourId: string,
  userId: string,
): Promise<ThankYouLetterBody> {
  const tour = await db.query.tours.findFirst({
    where: eq(tours.id, tourId),
  });
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  const explicit = (profile?.explicitData ?? {}) as { nickname?: string; aiTone?: AiTone };
  const nickname = explicit.nickname?.trim() || "Lữ khách";
  const tone = explicit.aiTone ?? "thu-thi";

  // Pull stop names from tourData.stops (if any) — limit to 3 to keep
  // the letter readable.
  const td = tour?.tourData as { stops?: { name?: string }[] } | null | undefined;
  const stopNames = (td?.stops ?? [])
    .map((s) => s?.name?.trim())
    .filter((n): n is string => !!n)
    .slice(0, 3);

  // Resolve a category for the sign-off bucket. Two cases:
  //   - experienceId set : read `experiences.category` directly (legacy
  //                        + host-authored bookings).
  //   - fixedTourId set  : derive from the tour's MATERIAL tags so the
  //                        curated catalog reuses the existing brand
  //                        sign-off pool (#ThanhTao → thanh-tao-xu-bac
  //                        etc., see lib/fixed-tour-category.ts).
  let category: string | undefined;
  if (tour?.experienceId) {
    const exp = await db.query.experiences.findFirst({
      where: eq(experiences.id, tour.experienceId),
    });
    category = exp?.category;
  } else if (tour?.fixedTourId) {
    category = (await lookupFixedTourCategory(db, tour.fixedTourId)) ?? undefined;
  }
  const signOffPool = CATEGORY_SIGN_OFFS[category ?? ""] ?? CATEGORY_SIGN_OFFS.__default__;
  const signOff = signOffPool[Math.abs(hashString(tourId)) % signOffPool.length];

  // Opening line via the LLM service. The prompt embeds the seed data so
  // mocks vary per tour. In Phase C this hits DeepSeek directly.
  const promptSeed = `tour=${tourId} stops=${stopNames.join("|")} category=${category ?? "other"}`;
  const openingLine = await llmGenerate({
    feature: "thank-you-letter",
    prompt: promptSeed,
    user: { nickname, tone },
  });

  // Canonical brand opening — fixed template, not LLM. The business
  // brief specifies this exact phrasing as the brand voice; the LLM
  // line above becomes a per-tour post-script for personality.
  const brandOpening =
    `Chào ${nickname}, hành trình vạn dặm nào cũng bắt đầu từ một bước ` +
    `chân, và Locomate rất vinh hạnh được là người đồng hành trong bước ` +
    `chân khám phá hôm nay của bạn. Cảm ơn bạn vì đã cùng tụi mình len ` +
    `lỏi qua từng góc phố.`;

  // Stamp the wrap-up coupon into the body. Best-effort — if the
  // coupon row is missing (issuance failed earlier, or this tour
  // pre-dates the coupon feature) the letter renders without the
  // coupon block.
  const { getWrapUpCouponForTour } = await import("./wrap-up-coupon");
  const coupon = await getWrapUpCouponForTour(db, tourId);

  return {
    greetingNickname: nickname,
    brandOpening,
    openingLine,
    stopsRecap: stopNames,
    signOff,
    category,
    couponCode: coupon?.code,
    couponExpiresAt: coupon?.expiresAt.toISOString(),
    discountPct: coupon?.discountPct,
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
