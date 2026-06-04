"use client";

import Image from "next/image";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { HOST_TOUR_PRICING } from "@/lib/pricing";
import { statusBadge } from "@/lib/format";

type Tab = "published" | "draft" | "archived";

export default function HostExperiencesListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const t = useTranslations("host.experiences.list");
  const tStatus = useTranslations("common.status");
  const [tab, setTab] = useState<Tab>("published");
  const utils = trpc.useUtils();

  const { data: rows, isLoading } = trpc.hostExperience.listMine.useQuery(
    undefined,
    { enabled: !!user && (user.role === "host" || user.role === "admin") },
  );

  const publishMutation = trpc.hostExperience.publish.useMutation({
    onSuccess: () => {
      toast.success(t("toast.published"));
      utils.hostExperience.listMine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.hostExperience.archive.useMutation({
    onSuccess: () => {
      toast.success(t("toast.archived"));
      utils.hostExperience.listMine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Client-side group by status -- one round-trip, instant tab switching.
  const grouped = {
    published: (rows ?? []).filter((r) => r.status === "published"),
    draft: (rows ?? []).filter((r) => r.status === "draft" || r.status === "rejected"),
    archived: (rows ?? []).filter((r) => r.status === "archived"),
  };

  return (
    <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Link href="/host/experiences/new">
          <Button className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl text-sm">
            {t("new")}
          </Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          {(["published", "draft", "archived"] as const).map((tabKey) => (
            <TabsTrigger key={tabKey} value={tabKey}>
              {t(`tabs.${tabKey}`)} ({grouped[tabKey].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {(["published", "draft", "archived"] as const).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey} className="mt-3 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : grouped[tabKey].length === 0 ? (
              <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
                <CardContent className="p-6 text-center space-y-2">
                  <p className="text-sm font-medium text-secondary">
                    {t("empty.heading")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`empty.${tabKey}`)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              grouped[tabKey].map((exp) => (
                <Card key={exp.id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-3 flex gap-3">
                    <div className="w-16 h-16 rounded-xl bg-muted shrink-0 overflow-hidden relative">
                      {exp.photos?.[0] && (
                        <Image
                          src={exp.photos[0]}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium truncate">
                          {exp.title}
                        </h3>
                        <StatusBadge status={exp.status} tStatus={tStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {(exp.priceAmount ?? 0).toLocaleString()}{" "}
                        {HOST_TOUR_PRICING.currency}
                        {" \u00B7 "}
                        {Math.floor((exp.durationMinutes ?? 0) / 60)}h
                        {" \u00B7 "}
                        {t("row.bookings", { n: exp.totalBookings ?? 0 })}
                      </p>
                      {exp.status === "rejected" && exp.reviewNotes && (
                        <p className="text-xs text-red-600 mt-0.5 truncate">
                          {exp.reviewNotes}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/host/experiences/${exp.id}/edit`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-lg"
                            disabled={exp.status === "archived" || exp.status === "published"}
                          >
                            {t("row.edit")}
                          </Button>
                        </Link>
                        <Link href={`/host/experiences/${exp.id}/preview`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg">
                            {t("row.preview")}
                          </Button>
                        </Link>
                        {(exp.status === "draft" || exp.status === "rejected") && (
                          <Button
                            size="sm"
                            className="h-7 text-xs rounded-lg bg-sage hover:bg-[#7bc25a] text-white"
                            disabled={publishMutation.isPending}
                            onClick={() => {
                              if (confirm(t("row.confirmPublish"))) {
                                publishMutation.mutate({ id: exp.id });
                              }
                            }}
                          >
                            {t("row.publish")}
                          </Button>
                        )}
                        {exp.status === "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-lg text-red-600 border-red-200"
                            disabled={archiveMutation.isPending}
                            onClick={() => {
                              if (confirm(t("row.confirmArchive"))) {
                                archiveMutation.mutate({ id: exp.id });
                              }
                            }}
                          >
                            {t("row.archive")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <button
        onClick={() => router.back()}
        className="block w-full text-center text-xs text-muted-foreground pt-2"
      >
        {t("back")}
      </button>
    </div>
  );
}

function StatusBadge({
  status,
  tStatus,
}: {
  status: string | null;
  tStatus: (key: string) => string;
}) {
  const cls = {
    published: "bg-sage/20 text-secondary dark:text-foreground",
    draft: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-700",
    archived: "bg-muted text-muted-foreground",
  }[status ?? "draft"] ?? "bg-muted text-muted-foreground";
  const b = statusBadge(status);
  const label = b.rawFallback ?? tStatus(b.labelKey);
  return (
    <Badge className={`${cls} border-0 text-xs shrink-0`}>
      {label}
    </Badge>
  );
}
