"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BrandTag, type BrandTagTone } from "./brand-tag";
import { ConicalHat, Lotus, MamCom, PhinFilter, HoiVanBand } from "./illustrations";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Phase A.9 — "Báo cáo sự cố" sheet.
 *
 * Opened from /tour/[id]/active when something goes off the rails (rain,
 * closure, discomfort, etc.). The sheet:
 *   1. Asks for a reason (4 brand tag chips).
 *   2. Calls `tour.proposeAlternatives`, which returns 3 nearby places
 *      with an italic-serif AI rationale per swap.
 *   3. User picks one — `onPicked` fires with the place + rationale and
 *      the sheet closes. The parent decides what to do with the pick
 *      (in Phase A: shows a toast; Phase B: actually swaps the stop).
 *
 * Mock mode: the rationales are canned per (tone, category) so demos
 * are deterministic. Same UI, real generation in Phase C.
 */

type ReasonValue = "rain" | "closed" | "discomfort" | "other";

const REASONS: { value: ReasonValue; label: string; tone: BrandTagTone }[] = [
  { value: "rain", label: "Mưa bão", tone: "esim" },
  { value: "closed", label: "Quán đóng cửa", tone: "merch" },
  { value: "discomfort", label: "Không thoải mái", tone: "workshop" },
  { value: "other", label: "Khác", tone: "guide" },
];

const ICON_BY_CATEGORY: Record<string, (size: number) => React.ReactNode> = {
  cafe: (s) => <PhinFilter size={s} color="var(--brick)" />,
  restaurant: (s) => <MamCom size={s} color="var(--brick)" />,
  cultural: (s) => <ConicalHat size={s} color="var(--brick)" />,
  __default: (s) => <Lotus size={s} color="var(--secondary)" />,
};

export interface IncidentPick {
  place: {
    id: string;
    name: string;
    slug: string | null;
    category: string;
    walkMinutes: number;
  };
  rationale: string;
  reason: ReasonValue;
}

export function IncidentSheet({
  open,
  onOpenChange,
  tourId,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  tourId: string;
  onPicked?: (pick: IncidentPick) => void;
}) {
  const [reason, setReason] = useState<ReasonValue | null>(null);
  const propose = trpc.tour.proposeAlternatives.useMutation();

  const handleReason = (r: ReasonValue) => {
    setReason(r);
    propose.mutate({ tourId, reason: r });
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      // Reset on close so the next open lands on the reason picker.
      setReason(null);
      propose.reset();
    }
    onOpenChange(next);
  };

  const alternatives = propose.data?.alternatives ?? [];
  const origin = propose.data?.origin;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <span className="text-eyebrow">Báo cáo sự cố</span>
          <SheetTitle className="text-h2 font-voice text-foreground font-normal leading-tight">
            Lịch trình lệch một nhịp — Locomate gợi ý lối khác.
          </SheetTitle>
          <SheetDescription className="text-sm">
            {origin
              ? `Đang ở ${origin.name}. Locomate sẽ tìm 3 chỗ thay thế gần đó.`
              : "Một câu hỏi nhanh để Locomate hiểu chuyện gì đang xảy ra."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 lg:px-6 pb-6 flex flex-col gap-4">
          {/* Reason picker */}
          {!reason && (
            <div className="flex flex-col gap-2">
              <span className="text-eyebrow">Vì sao?</span>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => handleReason(r.value)}
                    className="transition-transform active:scale-95"
                  >
                    <BrandTag tone={r.tone}>{r.label}</BrandTag>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading rationales */}
          {reason && propose.isPending && (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-md bg-muted animate-pulse"
                />
              ))}
            </div>
          )}

          {reason && propose.error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Locomate không gợi ý được lúc này. Thử lại trong giây lát.
            </div>
          )}

          {reason && !propose.isPending && alternatives.length === 0 && propose.isSuccess && (
            <p className="text-sm text-muted-foreground italic">
              Không có chỗ thay thế trong bán kính. Bạn có thể chọn &ldquo;Khác&rdquo; và mở rộng tìm kiếm.
            </p>
          )}

          {reason && alternatives.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-eyebrow">3 lối thay thế</span>
              {alternatives.map((alt) => {
                const iconFn = ICON_BY_CATEGORY[alt.category] ?? ICON_BY_CATEGORY.__default;
                return (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => {
                      onPicked?.({
                        place: {
                          id: alt.id,
                          name: alt.name,
                          slug: alt.slug,
                          category: alt.category,
                          walkMinutes: alt.walkMinutes,
                        },
                        rationale: alt.rationale,
                        reason: reason,
                      });
                      toast.success(`Đã chọn ${alt.name}. Locomate đang cập nhật lịch.`);
                      handleClose(false);
                    }}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-md border border-foreground/12 bg-paper text-left",
                      "hover:bg-muted/60 hover:ring-1 hover:ring-primary/30 transition-colors",
                    )}
                  >
                    <div className="w-12 h-12 rounded-md bg-card border border-foreground/10 flex items-center justify-center shrink-0">
                      {iconFn(36)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {alt.name}
                        </p>
                        <span className="font-mono text-xs text-brick shrink-0">
                          {alt.walkMinutes} phút
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mb-1.5">
                        {alt.category}
                      </p>
                      <p className="font-serif italic text-sm text-foreground leading-snug">
                        {alt.rationale}
                      </p>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setReason(null)}
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 self-start"
              >
                ← Đổi lý do
              </button>
            </div>
          )}
        </div>

        <HoiVanBand width={420} height={20} opacity={0.4} className="block w-full" />

        <div className="px-4 lg:px-6 py-3 border-t border-foreground/10">
          <Button
            variant="link"
            size="sm"
            onClick={() => handleClose(false)}
            className="w-full"
          >
            Đóng
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
