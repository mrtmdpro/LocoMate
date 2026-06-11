"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { HOST_TOUR_PRICING } from "@/lib/pricing";
import { statusBadge } from "@/lib/format";

/**
 * Read-only render that mirrors what the traveler-facing /experiences/[slug]
 * will show. Hosts use this to sanity-check their draft before publishing.
 */
export default function HostExperiencePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("host.experiences.preview");
  const tStatus = useTranslations("common.status");
  const { data: exp, isLoading } = trpc.hostExperience.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }
  if (!exp) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {t("notFound")}
      </div>
    );
  }

  const highlights = Array.isArray(exp.highlights)
    ? (exp.highlights as string[])
    : [];
  const schedule = Array.isArray(exp.schedule)
    ? (exp.schedule as { time: string; label: string }[])
    : [];
  const included = Array.isArray(exp.included)
    ? (exp.included as string[])
    : [];
  const photos = exp.photos ?? [];
  const coverPhoto = photos[0];

  return (
    <div className="pb-24">
      <div className="h-56 relative bg-gradient-to-br from-secondary to-sage overflow-hidden">
        {coverPhoto && (
          <Image
            src={coverPhoto}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 bg-card/90 rounded-full p-2 shadow-md z-10"
        >
          <svg
            className="w-5 h-5"
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
        <Badge className="absolute top-4 right-4 bg-amber-500 border-0 text-white text-xs capitalize">
          {t("badge", {
            status: (() => {
              const b = statusBadge(exp.status);
              return b.rawFallback ?? tStatus(b.labelKey);
            })(),
          })}
        </Badge>
        <div className="absolute bottom-4 left-4 right-4">
          <Badge className="bg-primary border-0 text-primary-foreground text-xs capitalize mb-2">
            {exp.category}
          </Badge>
          <h1 className="text-2xl font-bold font-heading text-white">
            {exp.title}
          </h1>
          {exp.subtitle && (
            <p className="text-sm text-white/80 mt-1">{exp.subtitle}</p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("facts.duration")}</p>
              <p className="text-sm font-bold text-secondary">
                {Math.round((exp.durationMinutes ?? 0) / 60)}h
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("facts.maxGroup")}</p>
              <p className="text-sm font-bold text-secondary">
                {exp.maxGroupSize ?? 1}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("facts.price")}</p>
              <p className="text-sm font-bold text-primary">
                {(exp.priceAmount ?? 0).toLocaleString()} {HOST_TOUR_PRICING.currency}
              </p>
            </div>
          </CardContent>
        </Card>

        {exp.description && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-secondary">{t("sections.about")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {exp.description}
              </p>
            </CardContent>
          </Card>
        )}

        {highlights.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-secondary">{t("sections.highlights")}</h2>
              <ul className="space-y-1">
                {highlights.map((h) => (
                  <li key={h} className="text-sm flex gap-2">
                    <span className="text-primary">&bull;</span>
                    {h}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {schedule.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-secondary">{t("sections.typicalDay")}</h2>
              <div className="space-y-2">
                {schedule.map((stop, i) => (
                  <div
                    key={`${stop.time}-${i}`}
                    className="flex gap-3 items-start"
                  >
                    <span className="font-mono text-xs text-primary shrink-0">
                      {stop.time}
                    </span>
                    <span className="text-sm">{stop.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {included.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-secondary">{t("sections.included")}</h2>
              <div className="flex flex-wrap gap-2">
                {included.map((item) => (
                  <Badge
                    key={item}
                    className="bg-secondary/10 text-foreground border-0 text-xs"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => router.push(`/host/experiences/${id}/edit`)}
          disabled={exp.status === "published" || exp.status === "archived"}
        >
          {exp.status === "published"
            ? t("archiveToEdit")
            : exp.status === "archived"
            ? t("archived")
            : t("edit")}
        </Button>
      </div>
    </div>
  );
}
