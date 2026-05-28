"use client";

import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ConicalHat, EmptyState } from "@/components/brand";

// Filter vocabulary. Canonical lowercase `value` is what the backend
// expects; `labelKey` resolves the i18n string via `hosts.filters.*`.
// Kept small and curated so anonymous visitors see a focused set of
// chips rather than the long tail of raw tag strings.
const SPECIALTY_FILTERS: { value: string | undefined; labelKey: string }[] = [
  { value: undefined, labelKey: "all" },
  { value: "food", labelKey: "food" },
  { value: "photography", labelKey: "photography" },
  { value: "culture", labelKey: "culture" },
  { value: "history", labelKey: "history" },
  { value: "cafe", labelKey: "cafe" },
  { value: "art", labelKey: "art" },
  { value: "nightlife", labelKey: "nightlife" },
  { value: "walking", labelKey: "walking" },
];

// `value` is the canonical English language name stored on the host
// profile (so the backend match still works for VI viewers). `labelKey`
// drives the i18n lookup.
const LANGUAGE_FILTERS: { value: string | undefined; labelKey: string }[] = [
  { value: undefined, labelKey: "any" },
  { value: "English", labelKey: "english" },
  { value: "Vietnamese", labelKey: "vietnamese" },
  { value: "French", labelKey: "french" },
  { value: "Japanese", labelKey: "japanese" },
];

export default function HostsDirectoryPage() {
  const t = useTranslations("hosts");
  const tLang = useTranslations("hosts.languages");
  const [specialty, setSpecialty] = useState<string | undefined>(undefined);
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [onlyTopRated, setOnlyTopRated] = useState(false);

  const { data: hosts, isLoading } = trpc.host.listPublic.useQuery({
    specialty,
    language,
    minRating: onlyTopRated ? 4.5 : undefined,
    limit: 50,
  });

  // Hide hosts that somehow have no slug (defensive; the backend already
  // filters these out but belt-and-braces).
  const visibleHosts = useMemo(
    () => (hosts ?? []).filter((h) => h.slug),
    [hosts],
  );

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-6 pb-20 lg:pb-8">
        {/* Brand-led header. The Locomate voice for hosts is "paired by
           personality" — italic display + Vietnamese subhead carry that. */}
        <div className="relative">
          <div className="absolute -right-2 -top-1 opacity-[0.16] pointer-events-none hidden sm:block">
            <ConicalHat size={140} />
          </div>
          <div className="relative flex flex-col gap-2 max-w-2xl">
            <span className="text-eyebrow">{t("eyebrow")}</span>
            <h1 className="text-display font-voice text-brick">{t("title")}</h1>
            <p className="font-serif italic text-base lg:text-lg text-muted-foreground">
              {t("subhero")}
            </p>
            <p className="text-sm text-foreground/80">
              {t("intro")}
            </p>
          </div>
        </div>

        {/* Specialty chips -- primary filter. */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SPECIALTY_FILTERS.map((f) => {
            const active = f.value === specialty;
            return (
              <button
                key={f.labelKey}
                type="button"
                onClick={() => setSpecialty(f.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-[0.12em] border transition-colors ${
                  active
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-card text-foreground border-foreground/15 hover:border-secondary/40"
                }`}
              >
                {t(`filters.${f.labelKey}`)}
              </button>
            );
          })}
        </div>

        {/* Secondary filters -- language + rating toggle. */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <span className="text-eyebrow">{t("languageLabel")}</span>
            <select
              value={language ?? ""}
              onChange={(e) => setLanguage(e.target.value || undefined)}
              className="text-xs font-medium text-foreground border border-foreground/22 rounded-md px-2.5 py-1.5 bg-paper"
            >
              {LANGUAGE_FILTERS.map((f) => (
                <option key={f.labelKey} value={f.value ?? ""}>{tLang(f.labelKey)}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyTopRated}
              onChange={(e) => setOnlyTopRated(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-foreground/85">{t("topRated")}</span>
          </label>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-40 bg-card border border-foreground/12 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : visibleHosts.length === 0 ? (
          <EmptyState
            illus={<ConicalHat size={180} />}
            eyebrow={t("empty.eyebrow")}
            title={t("empty.title")}
            body={t("empty.body")}
            actions={
              <Button
                variant="forest"
                size="brand"
                onClick={() => {
                  setSpecialty(undefined);
                  setLanguage(undefined);
                  setOnlyTopRated(false);
                }}
              >
                {t("empty.cta")}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleHosts.map((h) => (
              <Link key={h.id} href={`/hosts/${h.slug}`} className="group block">
                <Card className="overflow-hidden h-full transition-all group-hover:ring-2 group-hover:ring-primary/30">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-14 h-14 border-2 border-card shadow-none ring-1 ring-foreground/10">
                        {h.avatarUrl && <AvatarImage src={h.avatarUrl} alt={h.displayName} />}
                        <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
                          {h.displayName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-serif italic text-lg text-foreground truncate font-normal leading-6">
                            {h.displayName}
                          </p>
                          {h.verifiedAt && (
                            <span title={t("verified")} aria-label={t("verified")}>
                              <svg className="w-4 h-4 text-secondary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {Number(h.avgRating ?? 0) > 0
                            ? t("stats", {
                                rating: Number(h.avgRating).toFixed(1),
                                reviews: h.totalReviews ?? 0,
                                tours: h.totalTours ?? 0,
                              })
                            : t("newHost")}
                        </p>
                      </div>
                    </div>
                    {h.bio && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{h.bio}</p>}
                    {Array.isArray(h.specialties) && h.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(h.specialties as string[]).slice(0, 4).map((s) => (
                          <Badge key={s} variant="guide" className="capitalize tracking-normal normal-case">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
