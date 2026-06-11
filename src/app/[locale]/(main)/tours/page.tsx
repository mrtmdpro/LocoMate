"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  EmptyState,
  HoiVanBand,
  Lotus,
  MamCom,
} from "@/components/brand";
import { PageTransition } from "@/components/layout/page-transition";
import { fixedTourImage } from "@/lib/fixed-tour-images";
import type { Locale } from "@/i18n/routing";

export default function TourHistoryPage() {
  const router = useRouter();
  const t = useTranslations("tours");
  const locale = useLocale() as Locale;
  const { data: tourHistory, isLoading } = trpc.tour.getHistory.useQuery();

  const completedTours = (tourHistory || []).filter((t) => t.status === "completed");

  // Localised date formatters. `monthFmt` titles the group ("tháng 5
  // 2026" / "May 2026"); `cardDateFmt` labels each card ("27 thg 5,
  // 2026" / "May 27, 2026"). Both honour the App Language picked at
  // `/settings`, so the page never silently falls back to en-US.
  const monthFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
  const cardDateFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });

  const grouped: Record<string, typeof completedTours> = {};
  for (const tour of completedTours) {
    const date = tour.completedAt ? new Date(tour.completedAt) : new Date();
    const monthKey = monthFmt.format(date);
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(tour);
  }

  return (
    <PageTransition>
    <div className="pb-24 lg:pb-8 min-h-screen lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-6">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="flex flex-col">
          <span className="text-eyebrow">{t("eyebrow")}</span>
          <h1 className="text-display font-voice text-brick leading-tight">{t("hero")}</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : completedTours.length === 0 ? (
        <div className="px-4 pt-8">
          <EmptyState
            illus={<Lotus size={180} />}
            eyebrow={t("empty.eyebrow")}
            title={t("empty.title")}
            body={t("empty.body")}
            actions={
              <>
                <Link href="/experiences">
                  <Button variant="default" size="brand">{t("empty.ctaPrimary")}</Button>
                </Link>
                <Link href="/explore">
                  <Button variant="link" size="brand">{t("empty.ctaSecondary")}</Button>
                </Link>
              </>
            }
          />
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {Object.entries(grouped).map(([month, tours], monthIdx) => (
            <div key={month}>
              <span className="text-eyebrow mb-3 inline-block">{month}</span>
              <div className="space-y-3">
                {tours.map((tour) => {
                  const td = tour.tourData as { title?: string; stops?: { name: string }[] } | null;
                  const date = tour.completedAt ? new Date(tour.completedAt) : null;
                  // Fixed-Tour bookings carry the curated catalog photo at
                  // `/brand/fixed-tours/<tourId>.jpg`. Experience-booked or
                  // legacy algorithmic tours leave `fixedTourId` null and
                  // fall back to the brand MamCom motif. A future patch can
                  // join `experiences.slug` for the host-experience path.
                  const thumbnailUrl = tour.fixedTourId ? fixedTourImage(tour.fixedTourId) : null;
                  return (
                    <Link key={tour.id} href={`/tour/${tour.id}`}>
                      <Card className="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer overflow-hidden">
                        <div className="flex">
                          <div className="w-24 h-24 bg-secondary/15 flex items-center justify-center shrink-0 overflow-hidden relative">
                            {thumbnailUrl ? (
                              <Image
                                src={thumbnailUrl}
                                alt=""
                                fill
                                sizes="96px"
                                className="object-cover"
                              />
                            ) : (
                              <MamCom size={56} color="var(--secondary)" />
                            )}
                          </div>
                          <CardContent className="p-4 flex-1 min-w-0">
                            <h3 className="font-serif italic text-lg text-foreground truncate font-normal leading-6">
                              {td?.title || t("untitledFallback")}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {date && cardDateFmt.format(date)}
                              {" · "}
                              {t("stopsCount", { n: td?.stops?.length || 0 })}
                            </p>
                            <Badge variant="default" className="mt-2">{t("completedBadge")}</Badge>
                          </CardContent>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              {monthIdx < Object.keys(grouped).length - 1 && (
                <div className="flex justify-center pt-4">
                  <HoiVanBand width={200} height={20} opacity={0.4} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
