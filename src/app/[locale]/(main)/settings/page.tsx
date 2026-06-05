"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/brand";
import { trpc } from "@/lib/trpc";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Suggested Vietnamese nicknames -- these are part of the bilingual
 * brand voice (see messages/README.md). They render verbatim in both
 * locales because they're proper-noun-style stylings the user may pick.
 */
const NICKNAME_SUGGESTIONS = [
  "Kẻ lữ hành",
  "Cậu cả",
  "Nàng thơ",
  "Người mê dịch chuyển",
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const t = useTranslations("settings");
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);

  const { data: profileData } = trpc.user.getProfile.useQuery();
  const utils = trpc.useUtils();
  const setNickname = trpc.user.setNickname.useMutation({
    onSuccess: () => {
      utils.user.getProfile.invalidate();
      toast.success(t("nickname.toastSaved"));
    },
    onError: (e) => toast.error(e.message ?? t("nickname.toastError")),
  });
  const explicit = (profileData?.profile?.explicitData ?? {}) as { nickname?: string };
  const serverNickname = explicit.nickname ?? "";
  const [nicknameDraft, setNicknameDraft] = useState(serverNickname);
  // Sync the local draft when the server value lands (page refresh / first
  // mount). Avoids the field staying empty after the query resolves.
  useEffect(() => {
    setNicknameDraft(serverNickname);
  }, [serverNickname]);
  const nicknameDirty = nicknameDraft.trim() !== serverNickname.trim();

  return (
    <div className="pb-24 lg:pb-8 bg-background min-h-screen lg:max-w-3xl lg:mx-auto lg:px-8 lg:py-6">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 lg:px-0 lg:pt-0">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="flex flex-col">
          <span className="text-eyebrow">{t("eyebrow")}</span>
          <h1 className="text-h2 font-voice text-foreground font-normal leading-7">{t("title")}</h1>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Appearance — the brand's named modes + UI locale. */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.appearance")}</p>
          <Card>
            <CardContent className="p-0">
              <ThemeToggle variant="row" />
              <Separator />
              <AppLanguageRow />
            </CardContent>
          </Card>
        </div>

        {/* Account & nickname (danh xưng). */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.account")}</p>
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-eyebrow">{t("nickname.eyebrow")}</span>
                  <span className="text-sm text-muted-foreground">{t("nickname.helper")}</span>
                </div>
                <Input
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  placeholder={t("nickname.placeholder")}
                  maxLength={40}
                />
                <div className="flex flex-wrap gap-1.5">
                  {NICKNAME_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNicknameDraft(s)}
                      className="px-3 py-1 rounded-full border border-foreground/15 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!nicknameDirty || setNickname.isPending}
                    onClick={() => setNickname.mutate({ nickname: nicknameDraft.trim() })}
                  >
                    {setNickname.isPending ? t("nickname.saving") : t("nickname.save")}
                  </Button>
                  {serverNickname && (
                    <Button
                      variant="link"
                      size="sm"
                      disabled={setNickname.isPending}
                      onClick={() => {
                        setNicknameDraft("");
                        setNickname.mutate({ nickname: "" });
                      }}
                    >
                      {t("nickname.clear")}
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">{t("account.displayName")}</span>
                <span className="text-sm text-muted-foreground">{user?.displayName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">{t("account.email")}</span>
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
              <Separator />
              <button onClick={() => toast.info(t("account.changePasswordSoon"))} className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors">
                <span className="text-sm font-medium">{t("account.changePassword")}</span>
                <svg className="w-4 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
              {user?.role === "host" && (
                <>
                  <Separator />
                  <SwitchToTravelerRow />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.notifications")}</p>
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">{t("notifications.push")}</span>
                <Switch checked={pushNotifs} onCheckedChange={setPushNotifs} />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">{t("notifications.emailDigest")}</span>
                <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Privacy */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.privacy")}</p>
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">{t("privacy.locationSharing")}</span>
                <Switch checked={locationSharing} onCheckedChange={setLocationSharing} />
              </div>
              <Separator />
              <button onClick={() => toast.info(t("privacy.dataUsageSoon"))} className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors">
                <span className="text-sm font-medium">{t("privacy.dataUsage")}</span>
                <svg className="w-4 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* About */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.about")}</p>
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">{t("about.version")}</span>
                <span className="text-xs text-muted-foreground">1.0.0</span>
              </div>
              <Separator />
              {(["terms", "privacy", "licenses"] as const).map((item, i) => (
                <div key={item}>
                  <Link
                    href={`/legal/${item}`}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium">{t(`about.${item}`)}</span>
                    <svg className="w-4 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </Link>
                  {i < 2 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Link href="/security#danger-zone" className="block">
          <Button variant="outline" className="w-full text-destructive border-destructive/40 hover:bg-destructive/10">
            {t("deleteAccount")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * Switches the **UI language** of the entire app. This is the
 * counterpart to Profile → Spoken languages: that one tells *hosts* what
 * the traveler speaks, this one tells *the app* what to render in.
 *
 * Three things move in lockstep when the user picks a locale:
 *   1. `user.setLocale` is fired so the choice syncs across devices via
 *      `user_profiles.explicit_data.locale`.
 *   2. `router.replace(pathname, { locale: next })` swaps the URL so
 *      next-intl can re-render server components in the new language.
 *      The default-locale prefix is dropped per `localePrefix: "as-needed"`.
 *   3. next-intl's middleware writes the matching `NEXT_LOCALE` cookie on
 *      the next request so prefix-less URLs (`/home`) land correctly.
 *
 * Failure to persist the DB write is non-blocking — the URL+cookie still
 * carry the new locale on this device.
 */
/**
 * "Switch to traveler mode" row for hosts. The forward path
 * (`user.becomeHost`) lives in onboarding; this is the reverse and only
 * renders when `user.role === 'host'`.
 *
 * Flow:
 *   1. Show a Settings row + helper. Tapping it opens a confirmation
 *      Dialog that previews how many published listings will move to
 *      drafts (read from `host.getDashboard.myListingsCount.published`).
 *   2. Confirm fires `user.becomeTraveler`, which on the server:
 *        - blocks with PRECONDITION_FAILED if the host has paid/active
 *          tours,
 *        - else flips users.role, parks host_profiles.isAvailable=false,
 *          and drafts published experiences.
 *   3. On success: the auth store's `role` is patched (existing tokens
 *      keep working — server resolves role from DB on every request),
 *      caches are invalidated, and the user lands on /home where the
 *      traveler-only sections re-appear.
 *   4. On PRECONDITION_FAILED: surface the server message verbatim so
 *      the host knows how many tours are blocking them.
 *
 * The host_profiles row is preserved so a future `becomeHost` re-toggle
 * keeps their verification — symmetric with how `becomeHost` itself does
 * not clobber an existing verifiedAt.
 */
function SwitchToTravelerRow() {
  const t = useTranslations("settings.account.switchToTraveler");
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  // Preview the count of published listings that will be moved to draft.
  // `host.getDashboard` is host-gated, so guarding on user.role here keeps
  // the query from firing for non-hosts (and from re-firing once we flip
  // the role and navigate away).
  const dashboardQuery = trpc.host.getDashboard.useQuery(undefined, {
    enabled: user?.role === "host" && open,
  });
  const publishedCount = dashboardQuery.data?.myListingsCount.published ?? 0;

  const becomeTraveler = trpc.user.becomeTraveler.useMutation({
    onSuccess: (res) => {
      if (user) {
        setAuth({ ...user, role: res.role });
      }
      utils.user.getProfile.invalidate();
      utils.host.invalidate();
      setOpen(false);
      toast.success(t("toastSuccess"));
      router.push("/home");
    },
    onError: (err) => {
      // Server returns a human-readable "You have N upcoming or active
      // tours..." message for PRECONDITION_FAILED. Surface verbatim so the
      // host learns exactly why the switch was blocked.
      toast.error(err.message || t("toastError"));
      setOpen(false);
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors text-left"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium">{t("label")}</span>
          <span className="text-xs text-muted-foreground">{t("helper")}</span>
        </div>
        <svg className="w-4 h-4 text-muted-foreground/60 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("helper")}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>{t("dialogPauseProfile")}</li>
            <li>{t("dialogDraftListings", { count: publishedCount })}</li>
            <li>{t("dialogReversible")}</li>
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={becomeTraveler.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => becomeTraveler.mutate()}
              disabled={becomeTraveler.isPending}
            >
              {becomeTraveler.isPending ? "\u2026" : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AppLanguageRow() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("settings.appLanguage");
  const setLocaleMutation = trpc.user.setLocale.useMutation({
    onError: () => toast.error(t("toastError")),
  });

  function pick(next: Locale) {
    if (next === locale) return;
    setLocaleMutation.mutate({ locale: next });
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="flex items-center justify-between p-4 gap-4 flex-wrap">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-eyebrow">{t("eyebrow")}</span>
        <span className="font-serif italic text-base text-foreground leading-snug">
          {t(`label.${locale}`)}
        </span>
        <span className="text-xs text-muted-foreground mt-0.5">{t(`sub.${locale}`)}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t("aria")}
        className="inline-flex items-center bg-card border border-foreground/14 rounded-full p-0.5 gap-0.5"
      >
        {routing.locales.map((l) => {
          const active = locale === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(l)}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full transition-colors text-xs font-semibold",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`label.${l}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
