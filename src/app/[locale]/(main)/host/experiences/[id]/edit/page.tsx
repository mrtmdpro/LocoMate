"use client";

import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { HostExperienceWizard } from "../../_wizard";

export default function EditHostExperiencePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("host.experiences.edit");
  const { data: exp, isLoading, error } = trpc.hostExperience.getById.useQuery(
    { id },
  );
  const { data: host } = trpc.host.getProfile.useQuery();
  const hostIsVerified = host?.verificationStatus === "approved";

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }
  if (error || !exp) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("loadError")}
        </p>
        <Link href="/host/experiences">
          <Button variant="outline">{t("backToList")}</Button>
        </Link>
      </div>
    );
  }
  if (exp.status === "published" || exp.status === "archived") {
    return (
      <div className="p-4 space-y-3">
        <Card className="border border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-900">
              {t("lockedTitle")}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              {t("lockedBody")}
            </p>
          </CardContent>
        </Card>
        <Link href="/host/experiences">
          <Button variant="outline" className="w-full">
            {t("backToList")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <HostExperienceWizard
      hostIsVerified={hostIsVerified}
      initial={{
        id: exp.id,
        title: exp.title ?? "",
        titleVi: exp.titleVi ?? "",
        titleEn: exp.titleEn ?? "",
        subtitle: exp.subtitle ?? "",
        subtitleVi: exp.subtitleVi ?? "",
        subtitleEn: exp.subtitleEn ?? "",
        description: exp.description ?? "",
        descriptionVi: exp.descriptionVi ?? "",
        descriptionEn: exp.descriptionEn ?? "",
        category: exp.category ?? "cultural",
        durationMinutes: exp.durationMinutes ?? 180,
        priceAmount: exp.priceAmount ?? undefined,
        maxGroupSize: exp.maxGroupSize ?? 4,
        photos: exp.photos ?? [],
        highlights: Array.isArray(exp.highlights)
          ? (exp.highlights as string[])
          : [],
        included: Array.isArray(exp.included)
          ? (exp.included as string[])
          : [],
        schedule: Array.isArray(exp.schedule)
          ? (exp.schedule as { time: string; label: string }[])
          : [],
      }}
    />
  );
}
