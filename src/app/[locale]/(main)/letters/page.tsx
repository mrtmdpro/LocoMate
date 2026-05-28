"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  DongSonSun,
  HoiVanBand,
  HoiVanDivider,
  WaxSeal,
} from "@/components/brand";
import { shareElementAsPng } from "@/lib/share-wrap-up";
import type { Locale } from "@/i18n/routing";

interface LetterBody {
  greetingNickname?: string;
  /** Canonical brand opening — present on letters rendered after the
   *  May 2026 wrap-up upgrade. Older letters fall back to `openingLine`
   *  alone. */
  brandOpening?: string;
  openingLine?: string;
  stopsRecap?: string[];
  signOff?: string;
  category?: string;
  couponCode?: string;
  couponExpiresAt?: string;
  discountPct?: number;
}

/**
 * Phase A.6 — /letters surface.
 *
 * The user's thank-you letters, newest first. Each letter shows in its
 * own scroll-snap "page" so the experience feels like opening folded
 * paper rather than a feed. The Đông Sơn watermark + hồi-văn band stamp
 * mirror the brand-canvas empty-state composition.
 *
 * Mark-as-read fires once when a letter scrolls into view (intersection
 * observer would be cleaner — for the mock pass we mark all unread
 * letters once on mount).
 */
export default function LettersPage() {
  const router = useRouter();
  const { data: letters, isLoading } = trpc.user.getThankYouLetters.useQuery();
  const utils = trpc.useUtils();
  const markRead = trpc.user.markLetterRead.useMutation({
    onSuccess: () => utils.user.getThankYouLetters.invalidate(),
  });

  // Mark every unread letter as read once the user lands on this page.
  // Server-side `readAt` is for future notifications/badging; the user
  // doesn't expect to see "unread" pips for letters they're literally
  // looking at.
  useEffect(() => {
    if (!letters) return;
    for (const l of letters) {
      if (!l.readAt) markRead.mutate({ letterId: l.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters?.length]);

  if (isLoading) {
    return (
      <div className="p-6 lg:max-w-3xl lg:mx-auto">
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!letters || letters.length === 0) {
    return (
      <div className="p-6 lg:max-w-3xl lg:mx-auto">
        <div className="relative overflow-hidden rounded-lg bg-card border border-foreground/12">
          <div className="absolute -right-4 -top-3 opacity-[0.18] pointer-events-none">
            <DongSonSun size={180} />
          </div>
          <div className="relative flex flex-col items-start gap-4 p-7">
            <span className="text-eyebrow">Chưa có thư nào</span>
            <h2 className="text-h1 font-voice text-brick max-w-md font-normal leading-9">
              Mỗi chuyến đi để lại một bức thư.
            </h2>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Một tiếng sau khi chuyến đi khép lại, Locomate sẽ gửi bạn một thư cảm ơn — viết tay kiểu số, gọi đúng danh xưng bạn đã chọn. Tới đó, ngăn này sẽ đầy.
            </p>
          </div>
          <HoiVanBand width={420} height={20} opacity={0.5} className="block w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 lg:max-w-3xl lg:mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        <div className="flex flex-col">
          <span className="text-eyebrow">Thư cảm ơn</span>
          <h1 className="text-h1 font-voice text-foreground font-normal leading-tight">
            Ký ức gửi về.
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        {letters.map((l, i) => (
          <div key={l.id}>
            <LetterCard
              body={l.body as LetterBody}
              sentAt={l.sentAt ? new Date(l.sentAt) : null}
              letterId={l.id}
            />
            {i < letters.length - 1 && <HoiVanDivider className="mt-6" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One thank-you letter card. Renders the wax seal, the canonical brand
 * opening, the optional LLM-generated post-script line, the stops
 * recap, the coupon card (when issuance succeeded), and the
 * share-as-image footer.
 *
 * The `cardRef` points at the *visible* card; `shareElementAsPng`
 * captures exactly what the user sees, so the PNG includes the wax
 * seal + coupon code, perfect for an IG/FB Story share.
 */
function LetterCard({
  body,
  sentAt,
  letterId,
}: {
  body: LetterBody;
  sentAt: Date | null;
  letterId: string;
}) {
  const t = useTranslations("letter");
  const tCoupon = useTranslations("wrapUp.coupon");
  const locale = useLocale() as Locale;
  const cardRef = useRef<HTMLDivElement | null>(null);

  const nickname = body.greetingNickname ?? "Lữ khách";

  // Format the coupon expiry in the active locale. The ISO string is
  // produced server-side; the UI never parses it before rendering.
  const couponExpiresLabel = body.couponExpiresAt
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(body.couponExpiresAt))
    : null;

  const handleCopyCode = async () => {
    if (!body.couponCode) return;
    try {
      await navigator.clipboard.writeText(body.couponCode);
      toast.success(tCoupon("copied"));
    } catch {
      // navigator.clipboard can be undefined on http:// dev origins or
      // very old browsers. We surface a softer error so the user can
      // still copy by hand.
      toast.error(tCoupon("copyFailed"));
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const result = await shareElementAsPng(cardRef.current, {
        filename: `locomate-letter-${letterId}.png`,
        title: t("shareTitle"),
        text: t("shareText"),
      });
      toast.success(
        result.shared ? t("shareDone") : t("shareDownloaded"),
      );
    } catch (err) {
      console.error("letter share failed", err);
      toast.error(t("shareFailed"));
    }
  };

  return (
    <Card className="overflow-hidden" ref={cardRef}>
      <CardContent className="p-0">
        <div className="relative px-6 lg:px-8 pt-7 lg:pt-9 pb-5">
          {/* Đông Sơn watermark in the corner — kept from the previous
              design so the visual rhythm stays familiar. Wax seal sits
              on top, slightly inset from the corner so it overlaps the
              watermark gently. */}
          <div className="absolute -right-2 -top-2 opacity-[0.10] pointer-events-none">
            <DongSonSun size={120} color="var(--brick)" />
          </div>
          <div className="absolute top-4 right-4">
            <WaxSeal label={t("waxSealLabel")} size={56} />
          </div>

          <div className="relative flex items-center justify-between mb-3 pr-16">
            <span className="text-eyebrow">
              {t("greetingEyebrow", { nickname })}
            </span>
            {sentAt && (
              <span className="font-mono text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(sentAt)}
              </span>
            )}
          </div>

          {/* Canonical brand opening — italic serif, biggest type on
              the card. Falls back to the LLM line for letters written
              before the May 2026 upgrade so existing history doesn't
              regress. */}
          <p className="font-serif italic text-lg lg:text-xl text-foreground leading-relaxed">
            {body.brandOpening ??
              body.openingLine ??
              `${nickname} thân, cảm ơn vì đã đi cùng.`}
          </p>

          {/* The LLM-generated post-script — present alongside
              brandOpening on new letters as a per-tour personality
              touch. Falls silent when brandOpening is already showing
              the opening line. */}
          {body.brandOpening && body.openingLine && (
            <p className="font-serif italic text-base text-foreground/85 leading-relaxed mt-3">
              {body.openingLine}
            </p>
          )}

          {body.stopsRecap && body.stopsRecap.length > 0 && (
            <div className="mt-4 pt-4 border-t border-foreground/10">
              <span className="text-eyebrow">{t("visitedEyebrow")}</span>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {body.stopsRecap.map((s) => (
                  <li
                    key={s}
                    className="text-sm font-medium text-foreground"
                  >
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coupon card. Only renders when the wrap-up coupon was
              issued (and stamped into the letter body). Single-use,
              90-day expiry — the validation happens at /checkout. */}
          {body.couponCode && body.discountPct && couponExpiresLabel && (
            <div className="mt-5 rounded-lg border border-brick/30 bg-brick/5 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-eyebrow text-brick">
                    {tCoupon("yourGift")}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {tCoupon("discountN", { pct: body.discountPct })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tCoupon("expires", { date: couponExpiresLabel })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-brick tracking-wider tabular-nums px-3 py-1.5 rounded bg-card border border-brick/30">
                    {body.couponCode}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    type="button"
                  >
                    {tCoupon("copy")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {body.signOff && (
            <p className="mt-5 font-serif italic text-base text-brick">
              — {body.signOff}
            </p>
          )}

          {/* Share-as-image footer. Captures the whole card (including
              the wax seal + coupon block) as a PNG so the user can
              post it to a Story without leaving the app. */}
          <div className="mt-5 pt-4 border-t border-foreground/10 flex justify-end">
            <Button
              variant="link"
              size="sm"
              onClick={handleShare}
              type="button"
            >
              {t("shareCta")}
            </Button>
          </div>
        </div>
        <HoiVanBand
          width={420}
          height={20}
          opacity={0.5}
          className="block w-full"
        />
      </CardContent>
    </Card>
  );
}
