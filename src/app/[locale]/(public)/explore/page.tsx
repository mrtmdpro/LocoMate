"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { pickLocaleField } from "@/lib/pick-locale-field";
import type { Locale } from "@/i18n/routing";

const PlaceMap = dynamic(() => import("@/components/place-map"), {
  ssr: false,
  // Loading copy stays English for the loading skeleton (visible <1s) —
  // the rendered map UI uses MapLibre's tile-attribution which is also English.
  // Same /vi/explore visitor sees the localised category chips above the
  // map skeleton, so the brief moment of English in the skeleton blends.
  loading: () => <div className="w-full h-full bg-muted rounded-xl animate-pulse flex items-center justify-center text-sm text-muted-foreground">Loading map...</div>,
});

// Canonical lowercase `value` is what the backend `place.getFeed` expects;
// `labelKey` resolves the i18n string via `explore.filters.<labelKey>`.
// `undefined` value means "all" — passed to the query as no filter.
const CATEGORY_FILTERS: { value: string | undefined; labelKey: string }[] = [
  { value: undefined, labelKey: "all" },
  { value: "cafe", labelKey: "cafe" },
  { value: "restaurant", labelKey: "restaurant" },
  { value: "cultural", labelKey: "cultural" },
  { value: "nature", labelKey: "nature" },
  { value: "nightlife", labelKey: "nightlife" },
  { value: "workshop", labelKey: "workshop" },
  { value: "art", labelKey: "art" },
];

export default function ExplorePage() {
  const { user } = useAuthStore();
  const locale = useLocale() as Locale;
  const t = useTranslations("explore");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const { data, isLoading } = trpc.place.getFeed.useQuery(
    { category, search: search || undefined, limit: 20 }
  );

  const allPlaces = data?.places || [];
  const featuredPlace = allPlaces[0];
  const randomGem = allPlaces.length > 3 ? allPlaces[Math.floor(allPlaces.length / 2)] : allPlaces[1];
  const feedPlaces = allPlaces.slice(1);

  return (
    <PageTransition>
    <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {user ? (
            <Avatar className="w-9 h-9 border-2 border-primary/20">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="bg-secondary text-white font-bold text-xs">{(user.displayName || "?")[0]}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9" /></svg>
            </div>
          )}
          <h1 className="text-xl font-bold font-heading text-primary">{t("header")}</h1>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "list" ? "bg-card shadow-sm text-secondary" : "text-muted-foreground"}`}
          >
            {t("viewList")}
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "map" ? "bg-card shadow-sm text-secondary" : "text-muted-foreground"}`}
          >
            {t("viewMap")}
          </button>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-xl h-11 bg-card"
      />

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {CATEGORY_FILTERS.map((f) => {
          const active = f.value === category;
          return (
            <Badge
              key={f.labelKey}
              variant={active ? "default" : "outline"}
              className={`cursor-pointer px-3.5 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"
              }`}
              onClick={() => setCategory(f.value)}
            >
              {t(`filters.${f.labelKey}`)}
            </Badge>
          );
        })}
      </div>

      {/* Map View. Mobile: full-bleed edge-to-edge map below the filter row.
          Desktop (>= lg): map fills the content area with rounded corners --
          no negative margin since the content already sits inside the shell's
          padded column. Taller, too, because there's more vertical real
          estate on a laptop/desktop. */}
      {viewMode === "map" && (
        <div className="h-[calc(100vh-220px)] lg:h-[calc(100vh-160px)] -mx-4 lg:mx-0 rounded-none lg:rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">{t("loadingPlaces")}</div>
          ) : (
            <PlaceMap places={allPlaces as { id: string; slug: string | null; name: string; category: string; latitude: number | string; longitude: number | string; photos: string[] | null; avgRating: string | null; priceRange: string | null }[]} />
          )}
        </div>
      )}

      {/* Featured Gems Section.
          Mobile grid is a 3-col mosaic (2x2 hero + two side tiles).
          Desktop widens to 4-col and gives the hero more room via col-span-2
          row-span-2; the side tiles reuse the same grid slots. */}
      {viewMode === "list" && !search && category === undefined && featuredPlace && !isLoading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-secondary lg:text-lg">{t("featuredGems")}</h2>
            <span className="text-sm text-primary font-semibold">{t("viewAll")}</span>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-4">
            <Link href={`/explore/${(featuredPlace as { slug?: string }).slug || (featuredPlace as { id: string }).id}`} className="col-span-2 row-span-2 lg:col-span-2 lg:row-span-2">
              <Card className="border-0 shadow-md overflow-hidden h-full">
                <div className="h-full min-h-[200px] lg:min-h-[320px] relative overflow-hidden">
                  {(featuredPlace as { photos: string[] | null }).photos?.[0] && (
                    <Image src={(featuredPlace as { photos: string[] }).photos[0]} alt="" fill sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <Badge className="absolute top-3 left-3 bg-sage border-0 text-earth text-xs">{t("topChoice")}</Badge>
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5">
                    <span className="text-yellow-400 text-xs">★</span>
                    <span className="text-white text-xs font-bold">{Number((featuredPlace as { avgRating: string | null }).avgRating || 0).toFixed(1)}</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-sm line-clamp-2">{
                      pickLocaleField<string>(featuredPlace, "name", locale) ?? (featuredPlace as { name: string }).name
                    }</h3>
                    <p className="text-white/70 text-xs line-clamp-1 mt-0.5">{
                      pickLocaleField<string>(featuredPlace, "description", locale) ?? (featuredPlace as { description: string | null }).description
                    }</p>
                  </div>
                </div>
              </Card>
            </Link>
            {randomGem && (
              <Link href={`/explore/${(randomGem as { slug?: string }).slug || (randomGem as { id: string }).id}`}>
                <Card className="border-0 shadow-sm overflow-hidden h-full">
                  <div className="h-24 lg:h-[150px] relative overflow-hidden bg-gradient-to-br from-secondary to-[#A8C589]">
                    {(randomGem as { photos: string[] | null }).photos?.[0] && (
                      <Image src={(randomGem as { photos: string[] }).photos[0]} alt="" fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/20" />
                    <p className="absolute bottom-1.5 lg:bottom-2.5 left-2 lg:left-3 right-2 lg:right-3 text-white text-xs lg:text-xs font-semibold line-clamp-1">{
                      pickLocaleField<string>(randomGem, "name", locale) ?? (randomGem as { name: string }).name
                    }</p>
                  </div>
                </Card>
              </Link>
            )}
            <Card className="border-0 shadow-sm overflow-hidden bg-card flex items-center justify-center cursor-pointer h-full lg:min-h-[150px] hover:shadow-md transition-shadow" onClick={() => { const rand = allPlaces[Math.floor(Math.random() * allPlaces.length)]; if (rand) window.location.href = `/explore/${(rand as { slug?: string }).slug || (rand as { id: string }).id}`; }}>
              <CardContent className="p-3 lg:p-4 text-center">
                <p className="text-secondary font-bold text-xs lg:text-sm">{t("surprise")}</p>
                <p className="text-xs lg:text-xs text-secondary/60 mt-0.5">{t("surpriseTag")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Section heading */}
      {viewMode === "list" && !search && category === undefined && (
        <h2 className="font-bold text-secondary lg:text-lg pt-1">{t("popularNearYou")}</h2>
      )}

      {/* Places Feed. Mobile: single column. Desktop (>=lg): 2 cols, Desktop-
          XL: 3 cols. The cards themselves keep their original shape and
          rely on the grid to hand them a reasonable width. */}
      {viewMode === "list" && isLoading ? (
        <div className="space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:space-y-0">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:space-y-0">
          {(search || category !== undefined ? allPlaces : feedPlaces).map((place, idx) => (
            <motion.div
              key={(place as { id: string }).id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <PlaceCard place={place} locale={locale} />
            </motion.div>
          ))}
          {allPlaces.length === 0 && (
            <p className="text-center text-muted-foreground py-12 lg:col-span-full">{t("noPlaces")}</p>
          )}
        </div>
      ) : null}
    </div>
    </PageTransition>
  );
}

function PlaceCard({ place, locale }: { place: Record<string, unknown>; locale: Locale }) {
  const t = useTranslations("explore");
  const p = place as {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    category: string;
    priceRange: string | null;
    avgRating: string | null;
    totalReviews: number | null;
    photos: string[] | null;
    emotionalTags: Record<string, number>;
  };
  const name = pickLocaleField<string>(place, "name", locale) ?? p.name;
  const description = pickLocaleField<string>(place, "description", locale) ?? p.description;
  const topTags = Object.entries(p.emotionalTags || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const photo = p.photos?.[0];
  const reviewCount = p.totalReviews || 0;
  const reviewLabel = reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}k` : String(reviewCount);

  return (
    <Link href={`/explore/${p.slug || p.id}`}>
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <div className="h-40 bg-gradient-to-br from-secondary to-[#A8C589] relative overflow-hidden">
          {photo && <Image src={photo} alt={name ?? ""} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <Badge className="absolute top-3 right-3 bg-primary border-0 text-primary-foreground text-xs">{p.category}</Badge>
          {p.priceRange && (
            <Badge className="absolute top-3 left-3 bg-sage/90 border-0 text-earth text-xs">{t("budgetFriendly", { range: p.priceRange })}</Badge>
          )}
        </div>
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-secondary line-clamp-1">{name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">★ {Number(p.avgRating || 0).toFixed(1)} &middot; {reviewLabel} {t("reviewsLabel")}</p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="text-sm font-bold text-primary">{Number(p.avgRating || 0).toFixed(1)}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {topTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs capitalize px-2 py-0.5 font-semibold">{tag}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
