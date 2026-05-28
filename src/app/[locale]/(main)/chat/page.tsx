"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { Locale } from "@/i18n/routing";

type RelativeFormatter = (
  key: "now" | "minutes" | "hours" | "days",
  values?: Record<string, string | number | Date>,
) => string;

/** Locale-aware compact relative timestamp: "vừa xong" / "5 phút" / "2 giờ"
 *  in VI, "now" / "5m" / "2h" in EN. Falls back to a localized short date
 *  for anything ≥ 7 days old. */
function formatRelative(
  date: Date | string | null | undefined,
  locale: Locale,
  tRel: RelativeFormatter,
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return tRel("now");
  if (diffMin < 60) return tRel("minutes", { n: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return tRel("hours", { n: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return tRel("days", { n: diffDay });
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  return d.toLocaleDateString(tag, { month: "short", day: "numeric" });
}

export default function ChatInboxPage() {
  const { user } = useAuthStore();
  const locale = useLocale() as Locale;
  const t = useTranslations("chat.inbox");
  const tRel = useTranslations("chat.relative") as RelativeFormatter;
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [query, setQuery] = useState("");

  // Debounced query: the inbox filter hits the server; debouncing keeps
  // typing snappy without sending a request per keystroke.
  const debouncedQuery = useDebounce(query, 300);

  const { data: conversations, isLoading: convLoading } = trpc.chat.getConversations.useQuery({
    filter,
    q: debouncedQuery.trim().length >= 2 ? debouncedQuery : undefined,
  });

  const exportQuery = trpc.chat.exportHistory.useQuery(undefined, { enabled: false });

  const handleExport = async () => {
    const res = await exportQuery.refetch();
    if (!res.data) {
      toast.error(t("exportFailed"));
      return;
    }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `locomate-messages-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("exportSuccess"));
  };

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-3xl lg:mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">{t("title")}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportQuery.isFetching}
            className="text-xs"
          >
            {exportQuery.isFetching ? t("exporting") : t("export")}
          </Button>
        </div>

        {/* Search + filter row */}
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10"
            aria-label={t("searchAria")}
          />
          <div className="flex gap-2" role="group" aria-label={t("filterAria")}>
            {(
              [
                { id: "all", label: t("filterAll") },
                { id: "unread", label: t("filterUnread") },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  filter === f.id
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-card text-muted-foreground border-border hover:border-secondary/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {convLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : conversations?.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
            <CardContent className="p-8 text-center space-y-2">
              <div className="text-4xl">💬</div>
              <p className="text-base lg:text-lg font-semibold text-secondary">{t("empty.title")}</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {t("empty.body")}
              </p>
              <Link href="/hosts" className="inline-block pt-2 text-sm font-semibold text-primary">
                {t("empty.browseHosts")}
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations?.map((conv) => {
              const other = conv.otherUser;
              const isHost = other?.role === "host" || other?.role === "admin";
              const lastIsMine = conv.lastMessage?.senderId === user?.id;
              // Preview line mirrors iOS / WhatsApp: "You: <text>" when the
              // caller sent the last message, otherwise the bare text.
              const preview = conv.lastMessage?.content
                ? (lastIsMine ? t("youPrefix", { text: conv.lastMessage.content }) : conv.lastMessage.content)
                : t("sayHello");
              const lastTime = formatRelative(conv.lastMessage?.createdAt ?? conv.matchedAt ?? null, locale, tRel);
              const unread = conv.unreadCount > 0;

              return (
                <Link key={conv.matchId} href={`/chat/${conv.matchId}`}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        {other?.avatarUrl && <AvatarImage src={other.avatarUrl} alt={other.displayName || ""} />}
                        <AvatarFallback className="bg-secondary text-white font-bold">
                          {(other?.displayName || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h3 className={`text-sm lg:text-base truncate ${unread ? "font-bold text-foreground" : "font-semibold text-foreground/90"}`}>
                              {other?.displayName ?? t("fallbackName")}
                            </h3>
                            {isHost && (
                              <Badge className="bg-secondary/10 text-foreground border-0 text-xs shrink-0">{t("hostBadge")}</Badge>
                            )}
                          </div>
                          <span className={`text-xs shrink-0 tabular-nums ${unread ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {lastTime}
                          </span>
                        </div>
                        <p className={`text-sm truncate mt-0.5 ${unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {preview}
                        </p>
                      </div>
                      {unread && (
                        <div className="min-w-5 h-5 px-1.5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">{conv.unreadCount}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

/** Tiny 300ms debounce hook. Kept local to this file since it's the only
 * caller; a shared hook would imply more consistency than we need. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
