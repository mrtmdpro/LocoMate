"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { pickLocaleField } from "@/lib/pick-locale-field";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayName } from "@/lib/use-display-name";
import { formatVndPrice } from "@/lib/format";
import {
  Basket,
  ConicalHat,
  Cyclo,
  DongSonSun,
  FeatureCard,
  FolkStar,
  HoiVanDivider,
  Lotus,
  MamCom,
  Pagoda,
  Waves,
} from "@/components/brand";
import { fixedTourImage } from "@/lib/fixed-tour-images";
import { merchImage } from "@/lib/merch-images";
import { activityImage } from "@/lib/activity-image";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const locale = useLocale() as Locale;
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  // The /home feed is traveler-shaped (plan a tour, hidden gems, host
  // marketplace upsell). If a host lands here via a stale bookmark or the
  // bottom-nav "Home" tab before the nav itself goes role-aware, bounce them
  // to their real dashboard.
  useEffect(() => {
    if (user && (user.role === "host" || user.role === "admin")) {
      router.replace("/host");
    }
  }, [user, router]);
  const { isLoading: profileLoading } = trpc.user.getProfile.useQuery();
  const { data: tourHistory, isLoading: toursLoading } = trpc.tour.getHistory.useQuery();
  const { data: places, isLoading: placesLoading } = trpc.place.getFeed.useQuery({ limit: 6 });
  // Surface curated Fixed Tours ranked for the current chapter. The server
  // runs cosine against the user's saved quiz vector (if any) so the top
  // three are time-of-day-appropriate AND personalized.
  const currentChapter = chapterByCurrentHour();
  const { data: chapterRanked } = trpc.fixedTour.rank.useQuery({
    chapter: currentChapter,
    limit: 3,
  });
  const { data: activitiesList } = trpc.activity.list.useQuery({ limit: 6 });
  const { data: merchList } = trpc.merch.list.useQuery({ limit: 6 });
  const { data: hostsList } = trpc.host.listPublic.useQuery({ limit: 6 });
  // Hooks must run unconditionally — keep useDisplayName() above any
  // early-return for `profileLoading`. The hook internally returns a
  // sensible fallback while the underlying profile query is in flight.
  const { firstName } = useDisplayName();

  if (profileLoading || toursLoading || placesLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-7 w-32" /></div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div><Skeleton className="h-5 w-32 mb-3" /><div className="flex gap-3"><Skeleton className="h-20 w-16 rounded-full" /><Skeleton className="h-20 w-16 rounded-full" /><Skeleton className="h-20 w-16 rounded-full" /></div></div>
        <div><Skeleton className="h-5 w-28 mb-3" /><div className="flex gap-3"><Skeleton className="h-36 w-40 rounded-xl" /><Skeleton className="h-36 w-40 rounded-xl" /><Skeleton className="h-36 w-40 rounded-xl" /></div></div>
      </div>
    );
  }

  const activeTour = (tourHistory || []).find((t) => t.status === "active" || t.status === "paid");
  const completedTours = (tourHistory || []).filter((t) => t.status === "completed");
  const latestTour = completedTours[0];
  const topPlaces = places?.places?.slice(0, 5) || [];
  const topFixedTours = chapterRanked?.tours ?? [];
  const userHasVector = chapterRanked?.userHasVector ?? false;
  const topActivities = activitiesList?.slice(0, 4) || [];
  const topMerch = merchList?.slice(0, 4) || [];
  const topHosts = hostsList?.slice(0, 5) || [];

  // Daily-rotating subtitle below the slogan -- four variants keyed by
  // day-of-month so the page reads slightly different across the week
  // without us tracking a per-user shuffle. Each key takes `name` so
  // translations can choose to interpolate or ignore it.
  const subtitleIndex = new Date().getDate() % 4;
  const subtitle = t(`subtitle.v${subtitleIndex}`, { name: firstName });

  return (
    <PageTransition><div className="p-4 lg:p-8 space-y-6 lg:space-y-8 pb-8 lg:max-w-6xl lg:mx-auto">
      {/* Mobile location pin. The TopNav already renders avatar + theme +
          hamburger, so the page only needs to declare *where* (Hà Nội)
          on small screens. Hidden on desktop where the top bar sets
          context globally. */}
      <div className="flex items-center gap-2 lg:hidden">
        <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
        <span className="font-semibold text-foreground">{t("locationPin")}</span>
      </div>

      {/* Greeting / brand hero. Italic-serif voice carries the slogan; the
         personalised line sits underneath in the body sans. The Đông Sơn
         sun ornament only appears at lg+ where the headline has room to
         the right of it — at sm/md it overlapped the wrapping H1. Dark
         mode bumps its alpha so the silhouette doesn't flatten into the
         lacquered-forest page surface. */}
      <div className="relative">
        <div className="absolute -right-2 -top-3 opacity-[0.16] dark:opacity-30 pointer-events-none hidden lg:block">
          <DongSonSun size={140} />
        </div>
        <div className="relative flex flex-col">
          <span className="text-eyebrow">{t("greeting.eyebrow", { name: firstName })}</span>
          {/* Strict-mono: in vi this renders the folk pair ("Đi cho
              đúng, gặp cho trúng."); in en the English slogan. The
              cross-language second line is gone. */}
          <h1 className="text-display font-voice text-brick max-w-xl mt-1">
            {t("greeting.slogan")}
          </h1>
          <p className="text-sm lg:text-base text-foreground/80 mt-3">{subtitle}</p>
        </div>
      </div>

      {/* Search affordance. Linked to /explore which owns the real search
          UI -- this row is just an entry point, hence readOnly. The
          wrapping Link gets `role="search"` + an aria-label so screen
          readers don't announce it as an empty link. Placeholder is kept
          short enough to fit the 390 px viewport without truncation. */}
      <Link
        href="/explore"
        role="search"
        aria-label={t("search.aria")}
        className="block"
      >
        <Input
          readOnly
          placeholder={t("search.placeholder")}
          className="h-11 cursor-pointer"
        />
      </Link>

      {/* Your Day in Hanoi (Timeline) */}
      {(activeTour || latestTour) && (() => {
        const tour = activeTour || latestTour;
        const td = tour!.tourData as { title?: string; stops?: { name?: string; scheduledTime?: string; category?: string }[] } | null;
        const stops = td?.stops?.slice(0, 3) || [];
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <span className="text-eyebrow">{t("activeTrip.eyebrow")}</span>
                <h2 className="text-h1 font-voice text-foreground font-normal">{t("activeTrip.title")}</h2>
              </div>
              <Link href={`/tour/${tour!.id}${activeTour ? "/active" : ""}`} className="text-sm text-brick font-semibold underline underline-offset-4 decoration-brick/40 dark:decoration-brick/70">{t("activeTrip.viewFull")}</Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                {stops.map((stop, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-primary" : "bg-foreground/30 dark:bg-foreground/45"}`} />
                      {i < stops.length - 1 && <div className="w-0.5 h-8 bg-foreground/20 dark:bg-foreground/35" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm text-brick font-semibold">{stop.scheduledTime || `${9 + i}:00 AM`}</p>
                      <p className="text-sm lg:text-base font-medium text-foreground">{stop.name || t("activeTrip.fallbackStop", { n: i + 1 })}</p>
                    </div>
                  </div>
                ))}
                <Link href="/plan">
                  <Button variant="forest" size="brand" className="w-full mt-2">
                    {t("activeTrip.optimise")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Two-path CTA (when no active/past tours): Fixed Tours vs Flexible.
          The standardised-plus-flexible product model per the Apr 2026 BU
          pivot, dressed in the Locomate brand language. */}
      {!activeTour && !latestTour && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/experiences" className="block group">
            <div className="flex flex-col rounded-lg overflow-hidden h-full border border-foreground/12 bg-card transition-shadow group-hover:ring-1 group-hover:ring-primary/30">
              {/* Inset accent bar -- a quiet rule, not a banner. */}
              <div className="h-1 mx-5 lg:mx-6 mt-3 bg-primary rounded-full" />
              <div className="flex flex-col gap-3 p-5 lg:p-6 relative">
                <div className="absolute -right-3 -top-1 opacity-[0.20] pointer-events-none text-brick">
                  <Pagoda size={120} />
                </div>
                <span className="text-eyebrow">{t("twoPath.fixed.eyebrow")}</span>
                <h3 className="text-h2 font-voice text-foreground font-normal leading-7">{t("twoPath.fixed.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("twoPath.fixed.body")}</p>
              </div>
            </div>
          </Link>
          <Link href="/activities" className="block group">
            <div className="flex flex-col rounded-lg overflow-hidden h-full border border-foreground/12 bg-card transition-shadow group-hover:ring-1 group-hover:ring-secondary/30">
              <div className="h-1 mx-5 lg:mx-6 mt-3 bg-secondary rounded-full" />
              <div className="flex flex-col gap-3 p-5 lg:p-6 relative">
                <div className="absolute -right-3 -top-1 opacity-[0.20] pointer-events-none text-secondary">
                  <Cyclo size={140} />
                </div>
                <span className="text-eyebrow">{t("twoPath.flexible.eyebrow")}</span>
                <h3 className="text-h2 font-voice text-foreground font-normal leading-7">{t("twoPath.flexible.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("twoPath.flexible.body")}</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Feature highlights — what Locomate is, in six motifs. Only shown
         to first-time visitors so it doesn't crowd returning travellers. */}
      {!activeTour && !latestTour && (
        <>
          <HoiVanDivider className="py-2" />
          <div className="flex flex-col gap-2">
            <span className="text-eyebrow">{t("features.eyebrow")}</span>
            <h2 className="text-h1 font-voice text-foreground font-normal">{t("features.title")}</h2>
            <p className="text-sm lg:text-base text-muted-foreground max-w-xl">
              {t("features.body")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              accent="brick"
              illus={<DongSonSun size={64} />}
              kicker={t("features.aiMatch.kicker")}
              title={t("features.aiMatch.title")}
              body={t("features.aiMatch.body")}
              tags={[{ tone: "ai", label: t("features.aiMatch.tag") }]}
            />
            <FeatureCard
              accent="terracotta"
              illus={<span className="text-brick"><Pagoda size={64} /></span>}
              kicker={t("features.fixed.kicker")}
              title={t("features.fixed.title")}
              body={t("features.fixed.body")}
              tags={[
                { tone: "fixed", label: t("features.fixed.tagFixed") },
                { tone: "guide", label: t("features.fixed.tagGuide") },
              ]}
            />
            <FeatureCard
              accent="forest"
              illus={<span className="text-secondary"><Cyclo size={88} /></span>}
              kicker={t("features.flexible.kicker")}
              title={t("features.flexible.title")}
              body={t("features.flexible.body")}
              tags={[
                { tone: "flexible", label: t("features.flexible.tagFlexible") },
                { tone: "workshop", label: t("features.flexible.tagWorkshop") },
              ]}
            />
            <FeatureCard
              accent="brick"
              illus={<ConicalHat size={64} />}
              kicker={t("features.guides.kicker")}
              title={t("features.guides.title")}
              body={t("features.guides.body")}
              tags={[{ tone: "guide", label: t("features.guides.tagGuide") }]}
            />
            <FeatureCard
              accent="forest"
              illus={
                <div className="flex items-center gap-2 text-secondary">
                  <Basket size={56} />
                  <Waves width={70} height={40} color="var(--secondary)" opacity={0.6} />
                </div>
              }
              kicker={t("features.esim.kicker")}
              title={t("features.esim.title")}
              body={t("features.esim.body")}
              tags={[{ tone: "esim", label: t("features.esim.tag") }]}
            />
            <FeatureCard
              accent="terracotta"
              illus={
                <div className="flex items-center gap-2 text-brick">
                  <Basket size={56} />
                  <FolkStar size={44} />
                </div>
              }
              kicker={t("features.merch.kicker")}
              title={t("features.merch.title")}
              body={t("features.merch.body")}
              tags={[{ tone: "merch", label: t("features.merch.tag") }]}
            />
          </div>
          <HoiVanDivider className="py-2" />
        </>
      )}

      {/* Curated Fixed Tours for the current chapter. Server ranks by
          cosine when the user has a saved quiz vector; otherwise canonical
          tour_id order. The chapter is computed from the current hour so
          morning visitors see morning tours, evening visitors see evening
          tours. Tap "See all 15" to open the chapter hub on /experiences. */}
      {topFixedTours.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-h2 text-foreground">
                {t(`chapter.${chapterKeyFromId(currentChapter)}.long`)}
              </h2>
              {userHasVector && (
                <p className="text-xs text-muted-foreground">{t("chapter.personalisedSubtitle")}</p>
              )}
            </div>
            <Link href="/experiences" className="text-sm text-primary font-semibold">
              {t("chapter.seeAll15")}
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {topFixedTours.map((tour) => {
              // Strict-mono: card shows the active-locale title only.
              // The DB carries both Vi and En titles per tour.
              const tourTitle = locale === "vi" ? tour.titleVi : tour.titleEn;
              return (
              <Link
                key={tour.tourId}
                href={`/fixed-tours/${tour.tourId}`}
                className="shrink-0 w-56"
              >
                <Card className="overflow-hidden h-full pt-0 shadow-sm dark:ring-foreground/18">
                  {/* Thumbnail header with overlaid chapter badge +
                     match%. Keeps the card visually anchored even when
                     the user hasn't quizzed yet (no match pill). */}
                  <div className="h-28 relative overflow-hidden bg-muted">
                    <Image
                      src={fixedTourImage(tour.tourId)}
                      alt={tourTitle}
                      fill
                      sizes="(max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    {/* Token-paired chip on photo overlays. The earlier
                        `variant="fixed"` + bg-card/95 collided text-brick
                        with bg-card in dark mode (~3:1 -- fails AA).
                        `variant="guide"` is bg-card text-foreground in
                        both themes. */}
                    <Badge
                      variant="guide"
                      className="absolute top-2 left-2 bg-card/95 backdrop-blur-sm text-xs"
                    >
                      {t(`chapter.${chapterKeyFromId(tour.chapter as ChapterId)}.short`)}
                    </Badge>
                    {tour.matchPercent !== null && tour.matchPercent !== undefined && (
                      <span className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {tour.matchPercent}%
                      </span>
                    )}
                  </div>
                  <CardContent className="p-3 flex flex-col gap-1 h-full">
                    <p className="font-serif italic text-base text-foreground leading-tight line-clamp-2">
                      {tourTitle}
                    </p>
                    <p className="mt-auto text-sm font-bold text-brick whitespace-nowrap">
                      {formatVndPrice(tour.basePriceVnd)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden Gems */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h2 text-foreground">{t("hiddenGems.title")}</h2>
          <Link href="/explore" className="text-sm text-primary font-semibold">{tCommon("seeAll")}</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {topPlaces.map((place, idx) => {
            const p = place as { id: string; slug: string | null; name: string; category: string; photos: string[] | null; avgRating: string | null; totalReviews?: number };
            const pName = pickLocaleField<string>(place, "name", locale) ?? p.name;
            return (
              <Link key={p.id} href={`/explore/${p.slug || p.id}`} className="shrink-0 w-40">
                <Card className="overflow-hidden pt-0 shadow-sm dark:ring-foreground/18">
                  <div className="h-24 bg-gradient-to-br from-secondary to-[#A8C589] relative overflow-hidden">
                    {p.photos?.[0] && <Image src={p.photos[0]} alt={pName ?? ""} fill sizes="160px" className="object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {idx === 0 && <Badge className="absolute top-2 left-2 bg-sage border-0 text-earth text-xs">{t("hiddenGems.topChoice")}</Badge>}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      <span className="text-white text-xs font-bold">★ {Number(p.avgRating || 0).toFixed(1)}</span>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-semibold text-foreground line-clamp-1">{pName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Activities row -- a-la-carte tickets, workshops, classes. */}
      {topActivities.length > 0 && user?.role === "traveler" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-h2 text-foreground">{t("activities.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("activities.subtitle")}</p>
            </div>
            <Link href="/activities" className="text-sm text-primary font-semibold">{tCommon("seeAll")}</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {topActivities.map((a) => {
              const aTitle = pickLocaleField<string>(a, "title", locale) ?? a.title;
              const aPreview = a.photos?.[0] ?? activityImage(a.slug ?? null);
              return (
              <Link key={a.id} href={`/activities/${a.slug || a.id}`} className="shrink-0 w-48">
                <Card className="overflow-hidden pt-0 shadow-sm dark:ring-foreground/18">
                  <div className="h-24 relative overflow-hidden">
                    {aPreview && <Image src={aPreview} alt={aTitle ?? ""} fill sizes="160px" className="object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <Badge className="absolute top-2 left-2 bg-card/95 text-foreground border-0 text-xs uppercase tracking-wider">{a.category}</Badge>
                    <p className="absolute bottom-2 left-2 right-2 text-white text-xs font-bold line-clamp-1">{aTitle}</p>
                  </div>
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(a.durationMinutes / 60)}h{a.durationMinutes % 60 ? ` ${a.durationMinutes % 60}m` : ""}
                        {a.avgRating ? ` · ★ ${Number(a.avgRating).toFixed(1)}` : ""}
                      </p>
                      <p className="text-xs font-bold text-primary whitespace-nowrap">{formatVndPrice(a.priceAmount)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Meet our hosts carousel. Travelers only; horizontal scroll on mobile,
          grid of 4-5 tiles on desktop. Clicking a tile opens the host's
          public profile at /hosts/[slug]. */}
      {topHosts.length > 0 && user?.role === "traveler" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-h2 text-foreground">{t("hosts.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("hosts.subtitle")}</p>
            </div>
            <Link href="/hosts" className="text-sm text-primary font-semibold">{tCommon("seeAll")}</Link>
          </div>
          {/* Mobile keeps a horizontal scroll. Desktop switches to a flex
              row with generous column gap so 3-5 hosts cluster naturally
              instead of leaving four empty grid cells when the seed is
              small. */}
          <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-wrap lg:gap-x-10 lg:gap-y-4 lg:overflow-visible">
            {topHosts.map((h) => (
              <Link key={h.id} href={`/hosts/${h.slug}`} className="shrink-0 w-24 lg:w-28 group">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <Avatar className="w-20 h-20 lg:w-24 lg:h-24 border-4 border-card shadow transition-transform group-hover:scale-105">
                      {h.avatarUrl && <AvatarImage src={h.avatarUrl} alt={h.displayName} />}
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-lg">
                        {h.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                    {h.verifiedAt && (
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card ring-1 ring-foreground/20 dark:ring-foreground/30 flex items-center justify-center"
                        title={t("hosts.verified")}
                        aria-label={t("hosts.verified")}
                      >
                        <svg className="w-4 h-4 text-secondary dark:text-sage" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-2 line-clamp-1 w-full">
                    {h.displayName.split(" ").slice(-1)[0]}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 w-full">
                    {Number(h.avgRating ?? 0) > 0
                      ? t("hosts.statLine", { rating: Number(h.avgRating).toFixed(1), tours: h.totalTours ?? 0 })
                      : t("hosts.newHost")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Merch row */}
      {topMerch.length > 0 && user?.role === "traveler" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-h2 text-foreground">{t("merch.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("merch.subtitle")}</p>
            </div>
            <Link href="/shop" className="text-sm text-primary font-semibold">{tCommon("shopAll")}</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {topMerch.map((p) => {
              const pTitle = pickLocaleField<string>(p, "title", locale) ?? p.title;
              // Prefer the curated brand mockup; fall back to the DB column
              // for any future host-uploaded merch (FOLLOW-10).
              const photoUrl = p.slug ? merchImage(p.slug) : p.photos?.[0];
              return (
              <Link key={p.id} href={`/shop/${p.slug || p.id}`} className="shrink-0 w-32">
                <Card className="overflow-hidden pt-0 shadow-sm dark:ring-foreground/18">
                  <div className="h-24 bg-card relative overflow-hidden">
                    {photoUrl && <Image src={photoUrl} alt={pTitle ?? p.title ?? "Locomate merch"} fill sizes="128px" className="object-cover" />}
                    {p.bundleDiscountPct ? (
                      <Badge className="absolute top-1.5 left-1.5 bg-primary border-0 text-primary-foreground text-xs">{t("merch.bundleBadge", { pct: p.bundleDiscountPct })}</Badge>
                    ) : null}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{pTitle}</p>
                    <p className="text-sm text-primary font-bold whitespace-nowrap">{formatVndPrice(p.basePriceVnd)}</p>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* eSIM Banner with bundle copy. Sage wash + Waves motif sets the
         "connected" feel without a literal signal-bar emoji. */}
      <Link href="/esim">
        <Card className="overflow-hidden bg-sage/25 border-secondary/25">
          <CardContent className="p-4 flex items-center gap-4 relative">
            <div className="w-12 h-12 rounded-md bg-secondary text-secondary-foreground dark:bg-card dark:text-foreground dark:ring-1 dark:ring-secondary/40 flex items-center justify-center shrink-0">
              <Basket size={28} />
            </div>
            <div className="flex-1 relative">
              <p className="text-sm lg:text-base font-semibold text-foreground">{t("esim.title")}</p>
              <p className="text-sm text-muted-foreground">{t("esim.subtitle")}</p>
            </div>
            <svg className="w-4 h-4 text-secondary dark:text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </CardContent>
        </Card>
      </Link>
    </div></PageTransition>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Time-of-day helpers for the Fixed Tour ranking row.
 *
 *  Chapter windows mirror the spec at docs/sửa .md:
 *    MORNING    06:00 – 11:30
 *    AFTERNOON  13:30 – 17:30
 *    EVENING    18:00 – 22:30 (and wraps midnight back to morning)
 *
 *  Pre-06:00 surfaces MORNING (the next chapter to start); 11:30-13:30
 *  also rolls forward to AFTERNOON; 17:30-18:00 rolls forward to EVENING.
 * ────────────────────────────────────────────────────────────────────── */

type ChapterId = "MORNING_SHIFT" | "AFTERNOON_SHIFT" | "EVENING_SHIFT";

function chapterByCurrentHour(): ChapterId {
  // Hour in Asia/Ho_Chi_Minh — Vietnam doesn't observe DST so a static
  // UTC+7 offset is safe and avoids pulling Intl.DateTimeFormat for a
  // single integer. Falls back to local hour if the env clock is weird.
  const utcNow = new Date();
  const hour = (utcNow.getUTCHours() + 7) % 24;
  if (hour < 12) return "MORNING_SHIFT";
  if (hour < 17) return "AFTERNOON_SHIFT";
  return "EVENING_SHIFT";
}

/** Maps the shift enum (which the DB stores) to the `home.chapter.*`
 *  i18n key shape (`morning` / `afternoon` / `evening`). The actual
 *  user-visible strings come from the message catalogue, which keeps
 *  Vietnamese poetic ("Cho t\u1ed1i nay" / "T\u1ed1i") in vi and an
 *  English equivalent ("For tonight" / "Evening") in en. */
function chapterKeyFromId(
  id: ChapterId,
): "morning" | "afternoon" | "evening" {
  switch (id) {
    case "MORNING_SHIFT":
      return "morning";
    case "AFTERNOON_SHIFT":
      return "afternoon";
    case "EVENING_SHIFT":
      return "evening";
  }
}
