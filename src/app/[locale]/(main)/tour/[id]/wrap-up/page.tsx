"use client";

import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ConicalHat,
  DongSonSun,
  FireworksBurst,
  HoiVanBand,
  Lotus,
  MamCom,
  PhinFilter,
} from "@/components/brand";
import { shareElementAsPng } from "@/lib/share-wrap-up";

type PersonaAxisKey =
  | "art_aesthetic"
  | "deep_history"
  | "culinary"
  | "slow_living"
  | "balanced";

interface WrapUpStats {
  totalMinutes: number | null;
  totalStops: number;
  totalKm: number | null;
  personaAxisKey: PersonaAxisKey;
}

/**
 * Phase A.10 — Wrap-up storytelling.
 *
 * A vertical `scroll-snap-y` stack of full-height pages, each one a
 * data-driven memory page. Italic-serif narration in the middle, brand
 * motif as page watermark, share-as-image button per page.
 *
 * Pages come from `tour.getWrapUpPages` — a cover, one per visited stop
 * (with mocked-AI paragraph), then a closer. The data shape is stable so
 * Phase C can swap mock → real DeepSeek by flipping `LLM_MOCK_MODE`
 * without touching this page.
 */

const ICON_BY_CATEGORY: Record<string, (size: number, color?: string) => React.ReactNode> = {
  "thanh-tao-xu-bac": (s, c) => <ConicalHat size={s} color={c ?? "var(--brick)"} />,
  "hon-dat-nghe-nhan": (s, c) => <MamCom size={s} color={c ?? "var(--brick)"} />,
  "huong-men-nong-say": (s, c) => <PhinFilter size={s} color={c ?? "var(--brick)"} />,
  cafe: (s, c) => <PhinFilter size={s} color={c ?? "var(--brick)"} />,
  restaurant: (s, c) => <MamCom size={s} color={c ?? "var(--brick)"} />,
  cultural: (s, c) => <ConicalHat size={s} color={c ?? "var(--brick)"} />,
  __default: (s, c) => <Lotus size={s} color={c ?? "var(--secondary)"} />,
};

export default function WrapUpPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = trpc.tour.getWrapUpPages.useQuery({ tourId: id });

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="text-h2 font-voice text-brick">
          Đang gộp ký ức của bạn…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Không tìm thấy wrap-up cho chuyến này.
        </p>
      </div>
    );
  }

  // Total pages: cover + N stop pages + stats + closer.
  const totalPages = 1 + data.stops.length + 1 + 1;
  const statsPageNum = 1 + data.stops.length + 1;

  return (
    <div className="bg-background min-h-screen">
      <div className="snap-y snap-mandatory h-screen overflow-y-auto">
        <WrapPage page={1} total={totalPages} tourId={id} background="paper">
          {/* Fireworks burst plays on cover mount. Replays on tour
              change because the key is tourId-bound. */}
          <FireworksBurst key={`fx-cover-${id}`} />
          <CoverPage data={data.cover} />
        </WrapPage>
        {data.stops.map((s, i) => (
          <WrapPage
            key={i}
            page={i + 2}
            total={totalPages}
            tourId={id}
            background="card"
          >
            <StopPage stop={s} nickname={data.nickname} />
          </WrapPage>
        ))}
        <WrapPage
          page={statsPageNum}
          total={totalPages}
          tourId={id}
          background="paper"
        >
          {/* Second fireworks burst — celebrates the infographic
              reveal. Same key strategy as the cover for re-trigger. */}
          <FireworksBurst key={`fx-stats-${id}`} />
          <StatsPage stats={data.stats} nickname={data.nickname} />
        </WrapPage>
        <WrapPage
          page={totalPages}
          total={totalPages}
          tourId={id}
          background="paper"
          isLast
          onFinish={() => router.push("/letters")}
        >
          <CloserPage closer={data.closer} nickname={data.nickname} />
        </WrapPage>
      </div>
    </div>
  );
}

function WrapPage({
  page,
  total,
  tourId,
  background,
  isLast,
  onFinish,
  children,
}: {
  page: number;
  total: number;
  tourId: string;
  background: "paper" | "card";
  isLast?: boolean;
  onFinish?: () => void;
  children: React.ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);

  const handleShare = async () => {
    if (!pageRef.current) return;
    try {
      const result = await shareElementAsPng(pageRef.current, {
        filename: `locomate-wrapup-${tourId}-${page}.png`,
        title: "My Locomate wrap-up",
        text: "Một ngày Hà Nội của tôi.",
      });
      toast.success(
        result.shared ? "Đã chia sẻ." : "Đã tải xuống. Đăng lên đâu là bạn quyết.",
      );
    } catch (err) {
      console.error("share failed", err);
      toast.error("Không tạo được ảnh chia sẻ.");
    }
  };

  return (
    <section
      className={`snap-start h-screen w-full flex items-center justify-center px-4 lg:px-8 ${
        background === "paper" ? "bg-paper" : "bg-card"
      }`}
    >
      <div
        ref={pageRef}
        className={`relative w-full max-w-md lg:max-w-lg h-[88vh] rounded-lg border border-foreground/12 overflow-hidden flex flex-col ${
          background === "paper" ? "bg-paper" : "bg-card"
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-eyebrow">
            {page} / {total}
          </span>
          <span className="font-mono text-xs text-muted-foreground">Locomate</span>
        </div>
        <div className="flex-1 flex flex-col justify-center px-6 lg:px-10 pb-4">
          {children}
        </div>
        <HoiVanBand width={420} height={20} opacity={0.45} className="block w-full" />
        <div className="px-6 py-3 flex items-center justify-between gap-3 border-t border-foreground/10">
          <Button variant="link" size="sm" onClick={handleShare}>
            Chia sẻ trang này
          </Button>
          {isLast && (
            <Button variant="default" size="sm" onClick={onFinish}>
              Mở Thư cảm ơn
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function CoverPage({
  data,
}: {
  data: {
    eyebrow: string;
    name: string;
    title: string;
    tagline: string;
  };
}) {
  return (
    <div className="relative flex flex-col gap-3">
      <div className="absolute right-0 -top-6 opacity-[0.18] pointer-events-none">
        <DongSonSun size={180} color="var(--brick)" />
      </div>
      <span className="text-eyebrow">{data.eyebrow}</span>
      <h1 className="font-serif italic text-5xl lg:text-6xl text-brick font-normal leading-[0.95]">
        {data.name}
      </h1>
      <p className="text-h2 font-voice text-foreground leading-tight mt-2">
        {data.title}
      </p>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-6 font-mono">
        {data.tagline}
      </p>
    </div>
  );
}

function StopPage({
  stop,
  nickname,
}: {
  stop: { name: string; category: string; paragraph: string };
  nickname: string;
}) {
  const iconFn = ICON_BY_CATEGORY[stop.category] ?? ICON_BY_CATEGORY.__default;
  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute -right-3 -top-2 opacity-[0.15] pointer-events-none">
        {iconFn(140)}
      </div>
      <span className="text-eyebrow">Một khoảnh khắc</span>
      <h2 className="text-h1 font-voice text-foreground font-normal leading-tight">
        {stop.name}
      </h2>
      <p className="font-serif italic text-lg text-foreground/85 leading-relaxed mt-2">
        {stop.paragraph}
      </p>
      <p className="font-mono text-xs text-muted-foreground/70 mt-4 uppercase tracking-[0.14em]">
        — gửi {nickname}
      </p>
    </div>
  );
}

function CloserPage({
  closer,
  nickname,
}: {
  closer: { totalStops: number; signOff: string; category?: string };
  nickname: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 items-start">
      <div className="absolute right-0 top-0 opacity-[0.16] pointer-events-none">
        <Lotus size={160} color="var(--brick)" />
      </div>
      <span className="text-eyebrow">Khép lại</span>
      <h2 className="font-serif italic text-4xl text-brick font-normal leading-tight">
        Một ngày của {nickname}.
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        {closer.totalStops} điểm dừng · ký ức đã gói lại trong đây.
      </p>
      <p className="text-h3 font-voice text-foreground mt-6 leading-relaxed">
        — {closer.signOff}
      </p>
    </div>
  );
}

/**
 * StatsPage — the infographic dashboard slot.
 *
 * Three big numbers + one persona title, all from the server-side
 * `deriveWrapUpStats` derivation. The km row only renders when the
 * tour was Fixed-Tour-backed (`stats.totalKm !== null`); the totalTime
 * row only renders when both `startedAt` and `completedAt` are set
 * (rare miss path on a normal tour-complete flow).
 *
 * Copy comes from the `wrapUp.stats.*` i18n namespace so EN and VI
 * both read brand-native. The persona title is keyed via
 * `wrapUp.stats.personaTitles.<axisKey>` — the four axes plus the
 * "balanced" fallback all have brand-written titles.
 */
function StatsPage({
  stats,
  nickname,
}: {
  stats: WrapUpStats;
  nickname: string;
}) {
  const t = useTranslations("wrapUp.stats");
  const hours = stats.totalMinutes !== null ? Math.floor(stats.totalMinutes / 60) : null;
  const remMinutes = stats.totalMinutes !== null ? stats.totalMinutes % 60 : null;
  const personaTitle = t(`personaTitles.${stats.personaAxisKey}`);

  return (
    <div className="relative flex flex-col gap-5 items-start">
      <div className="absolute -right-3 -top-3 opacity-[0.14] pointer-events-none">
        <DongSonSun size={180} color="var(--brick)" />
      </div>
      <span className="text-eyebrow relative">{t("eyebrow")}</span>
      <h2 className="font-serif italic text-3xl text-brick font-normal leading-tight relative">
        {nickname}.
      </h2>

      {/* Three big numbers. Each row stays at zero height when its
          data is null (totalTime + totalKm), so the layout collapses
          gracefully on tours without geo / without start time. */}
      <div className="relative grid grid-cols-1 gap-3 mt-2 w-full">
        {hours !== null && remMinutes !== null && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif italic text-5xl lg:text-6xl text-brick leading-none tabular-nums">
              {hours > 0
                ? t("totalTimeHours", { h: hours, m: remMinutes })
                : t("totalTime", { n: remMinutes })}
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-serif italic text-5xl lg:text-6xl text-brick leading-none tabular-nums">
            {t("totalStops", { n: stats.totalStops })}
          </span>
        </div>
        {stats.totalKm !== null && (
          <div className="flex items-baseline gap-2">
            <span className="font-serif italic text-5xl lg:text-6xl text-brick leading-none tabular-nums">
              {t("totalKm", { km: stats.totalKm.toFixed(1) })}
            </span>
          </div>
        )}
      </div>

      {/* Persona title — the "danh hiệu vui" the brief asks for.
          Surfaced as a distinct chip + label pairing so it reads as
          an award, not just another stat row. */}
      <div className="relative mt-4 flex flex-col gap-1">
        <span className="text-eyebrow">{t("personaTitle")}</span>
        <span className="text-h2 font-voice text-foreground font-normal leading-tight">
          {personaTitle}
        </span>
      </div>
    </div>
  );
}
