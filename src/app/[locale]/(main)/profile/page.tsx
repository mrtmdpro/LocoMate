"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { serverLogout } from "@/lib/trpc-auth-link";
import { toast } from "sonner";
import { SPOKEN_LANGUAGES, type SpokenLanguage } from "@/lib/spoken-languages";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { data, isLoading: profileLoading } = trpc.user.getProfile.useQuery();
  const { data: tourHistory, isLoading: toursLoading } = trpc.tour.getHistory.useQuery();
  const { data: contacts } = trpc.user.getEmergencyContacts.useQuery();
  const { data: savedPlacesData, isLoading: savedLoading } = trpc.place.getSavedPlaces.useQuery();

  const profile = data?.profile;
  const derived = (profile?.derivedData || {}) as {
    personality?: Record<string, number>;
    personalityLabel?: string;
  };
  const explicit = (profile?.explicitData || {}) as {
    intent?: string[]; interests?: string[]; budget?: string;
    style?: { chill_explore?: number; plan_spontaneous?: number };
    social_preference?: string; time_preference?: string[];
    languages?: string[];
  };

  // All hooks must run unconditionally on every render (rules-of-hooks).
  // The early-return for profileLoading happens AFTER these are declared.
  const completedTours = useMemo(
    () => (tourHistory || []).filter((t) => t.status === "completed"),
    [tourHistory],
  );

  const tourPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of completedTours) {
      const td = t.tourData as { stops?: { placeId?: string }[] } | null;
      for (const s of td?.stops || []) { if (s?.placeId) ids.add(s.placeId); }
    }
    return Array.from(ids);
  }, [completedTours]);

  const { data: verifiedTourPlaces, isLoading: verifyLoading } = trpc.place.getByIds.useQuery(
    { ids: tourPlaceIds },
    { enabled: tourPlaceIds.length > 0 }
  );

  const savedCount = useMemo(() => {
    if (toursLoading || savedLoading || (tourPlaceIds.length > 0 && verifyLoading)) return null;
    const ids = new Set<string>();
    for (const p of savedPlacesData || []) ids.add(p.id);
    for (const p of verifiedTourPlaces || []) ids.add(p.id);
    return ids.size;
  }, [toursLoading, savedLoading, verifyLoading, savedPlacesData, verifiedTourPlaces, tourPlaceIds.length]);

  if (profileLoading) {
    return (
      <div className="p-4 lg:p-8 lg:max-w-4xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
        <div className="flex items-center justify-between"><div className="w-6 h-6 bg-muted/80 rounded animate-pulse" /><div className="h-5 w-14 bg-muted/80 rounded animate-pulse" /><div className="w-6 h-6 bg-muted/80 rounded animate-pulse" /></div>
        <div className="flex flex-col items-center pt-4"><div className="w-24 h-24 rounded-full bg-muted/80 animate-pulse" /><div className="h-5 w-32 bg-muted/80 rounded mt-3 animate-pulse" /><div className="h-4 w-24 bg-muted rounded mt-2 animate-pulse" /></div>
        <div className="h-28 bg-muted/80 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3"><div className="h-16 bg-muted rounded-xl animate-pulse" /><div className="h-16 bg-muted rounded-xl animate-pulse" /><div className="h-16 bg-muted rounded-xl animate-pulse" /></div>
      </div>
    );
  }

  const topTraits = Object.entries(derived.personality || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ name: k, value: Math.round(v * 100) }));

  const personalityLabel = derived.personalityLabel || t("personality.defaultLabel");
  const fitScore = topTraits.length > 0 ? Math.round(topTraits.reduce((s, t) => s + t.value, 0) / topTraits.length) : 75;

  async function handleLogout() {
    await serverLogout();
    logout();
    router.push("/login");
  }

  return (
    <div className="pb-24 bg-background">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => router.back()} aria-label={tCommon("back")} className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-h2 font-semibold text-foreground">{t("title")}</h1>
        <Link href="/settings" aria-label={t("appSettingsAria")} className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </Link>
      </div>

      {/* Centered Avatar + Name */}
      <div className="flex flex-col items-center px-4 pt-2 pb-4">
        <div className="relative">
          <Avatar className="w-24 h-24 border-4 border-card shadow-lg">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-3xl font-bold">
              {(user?.displayName || "?")[0]}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-sage border-2 border-card rounded-full" />
        </div>
        <h2 className="text-2xl lg:text-3xl font-bold font-heading text-foreground mt-3">{user?.displayName}</h2>
        <MemberBadge tourCount={completedTours.length} />
      </div>

      <div className="px-4 space-y-4">
        {/* Travel Personality Card - Dark Teal */}
        <Card className="bg-secondary text-secondary-foreground overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-card/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
              </div>
              <span className="text-xs font-medium text-secondary-foreground/80 uppercase tracking-wider">{t("personality.eyebrow")}</span>
            </div>
            <h3 className="text-xl lg:text-2xl font-bold font-heading">{personalityLabel}</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-card/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${fitScore}%` }} />
              </div>
              <span className="text-sm font-semibold text-primary">{t("personality.localFit", { score: fitScore })}</span>
            </div>
          </CardContent>
        </Card>

        {/* My Preferences */}
        <Link href="/profile/preferences">
          <Card className="bg-primary/5 ring-primary/25">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm">✏️</div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-primary">{t("preferences.title")}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {(explicit.intent ?? []).slice(0, 2).join(", ") || t("preferences.fallback")} &middot; {explicit.budget || t("preferences.budgetFallback")} &middot; {(explicit.social_preference || "solo").replaceAll("_", " ")}
                </p>
              </div>
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </CardContent>
          </Card>
        </Link>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("stats.savedPlaces"), value: savedCount ?? "—" },
            { label: t("stats.toursTaken"), value: completedTours.length },
            { label: t("stats.experiences"), value: 0 },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PERSONAL Section */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.personal")}</p>
          <Card>
            <CardContent className="p-0">
              <EmergencyContactsRow contacts={contacts || []} />
              <Separator />
              <SpokenLanguagesRow initial={(explicit.languages || []) as SpokenLanguage[]} />
            </CardContent>
          </Card>
        </div>

        {/* ACTIVITY Section */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.activity")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/saved">
              <Card className="overflow-hidden cursor-pointer hover:shadow-sm transition-shadow">
                <div className="h-24 bg-gradient-to-br from-card to-sage/30 flex items-center justify-center">
                  <div className="text-2xl">📍</div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm lg:text-base font-semibold text-foreground">{t("activity.savedPlaces.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("activity.savedPlaces.count", { count: savedCount ?? 0 })}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/tours">
              <Card className="overflow-hidden cursor-pointer hover:shadow-sm transition-shadow">
                <div className="h-24 bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center">
                  <div className="text-center text-secondary-foreground">
                    <p className="text-xs uppercase tracking-wider opacity-70">{t("activity.tourHistory.title")}</p>
                    <p className="text-lg font-heading font-bold">🗺</p>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm lg:text-base font-semibold text-foreground">{t("activity.tourHistory.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("activity.tourHistory.count", { count: completedTours.length })}</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* ACCOUNT & SECURITY Section */}
        <div>
          <p className="text-eyebrow mb-2 px-1">{t("sections.accountSecurity")}</p>
          <Card>
            <CardContent className="p-0">
              <Link href="/security" className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm">🔒</div>
                <span className="flex-1 text-sm lg:text-base font-medium">{t("rows.securitySettings")}</span>
                <svg className="w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
              <Separator />
              <Link href="/orders" className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm">🛍</div>
                <span className="flex-1 text-sm lg:text-base font-medium">{t("rows.orderHistory")}</span>
                <svg className="w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
              <Separator />
              <Link href="/payments" className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm">💳</div>
                <span className="flex-1 text-sm lg:text-base font-medium">{t("rows.paymentHistory")}</span>
                <svg className="w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
              <Separator />
              <Link href="/esim" className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-sm">📶</div>
                <span className="flex-1 text-sm lg:text-base font-medium">{t("rows.vietnamEsim")}</span>
                <Badge className="bg-sage/20 text-foreground border-0 text-xs">GoHub</Badge>
                <svg className="w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Button variant="outline" onClick={handleLogout} className="w-full rounded-xl text-destructive border-destructive/40 hover:bg-destructive/10">
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}

function EmergencyContactsRow({ contacts: initialContacts }: { contacts: { id: string; name: string; phone: string; relationship: string | null; isPrimary: boolean | null }[] }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relationship: "" });
  const utils = trpc.useUtils();
  const t = useTranslations("profile.emergency");
  const tCommon = useTranslations("common");

  const addMutation = trpc.user.setEmergencyContact.useMutation({
    onSuccess: () => { utils.user.getEmergencyContacts.invalidate(); setAdding(false); setForm({ name: "", phone: "", relationship: "" }); toast.success(t("toastAdded")); },
  });
  const updateMutation = trpc.user.updateEmergencyContact.useMutation({
    onSuccess: () => { utils.user.getEmergencyContacts.invalidate(); setEditing(null); toast.success(t("toastUpdated")); },
  });
  const deleteMutation = trpc.user.deleteEmergencyContact.useMutation({
    onSuccess: () => { utils.user.getEmergencyContacts.invalidate(); toast.success(t("toastRemoved")); },
  });

  function startEdit(c: typeof initialContacts[0]) {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone, relationship: c.relationship || "" });
  }

  return (
    <>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/60 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-sm">🆘</div>
        <span className="flex-1 text-sm lg:text-base font-medium">{t("title")}</span>
        <Badge variant="outline" className="text-xs">{initialContacts.length}</Badge>
        <svg className={`w-4 h-4 text-muted-foreground/40 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {initialContacts.map((c) =>
            editing === c.id ? (
              <div key={c.id} className="p-3 bg-muted/40 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">{t("nameLabel")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs rounded-lg" /></div>
                  <div><Label className="text-xs">{t("relationshipLabel")}</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="h-8 text-xs rounded-lg" placeholder={t("relationshipMotherPlaceholder")} /></div>
                </div>
                <div><Label className="text-xs">{t("phoneLabel")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs rounded-lg" /></div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/85 text-primary-foreground rounded-lg" disabled={!form.name || !form.phone || updateMutation.isPending} onClick={() => updateMutation.mutate({ id: c.id, name: form.name, phone: form.phone, relationship: form.relationship || undefined })}>{updateMutation.isPending ? "..." : tCommon("save")}</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => setEditing(null)}>{tCommon("cancel")}</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-destructive border-destructive/40 hover:bg-destructive/10 ml-auto" onClick={() => deleteMutation.mutate({ id: c.id })}>{tCommon("delete")}</Button>
                </div>
              </div>
            ) : (
              <div key={c.id} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg group">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-sm">👤</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.relationship} &middot; {c.phone}</p></div>
                {c.isPrimary && <Badge className="bg-destructive/15 text-destructive border-0 text-xs">{t("primary")}</Badge>}
                <button onClick={() => startEdit(c)} className="opacity-0 group-hover:opacity-100 text-sm text-primary font-semibold transition-opacity">{tCommon("edit")}</button>
              </div>
            )
          )}
          {adding ? (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-secondary">{t("addContact")}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">{t("nameLabel")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs rounded-lg" placeholder={t("contactNamePlaceholder")} /></div>
                <div><Label className="text-xs">{t("relationshipLabel")}</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="h-8 text-xs rounded-lg" placeholder={t("relationshipFriendPlaceholder")} /></div>
              </div>
              <div><Label className="text-xs">{t("phoneLabel")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="+84..." /></div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/85 text-primary-foreground rounded-lg" disabled={!form.name || !form.phone || addMutation.isPending} onClick={() => addMutation.mutate({ name: form.name, phone: form.phone, relationship: form.relationship || undefined, isPrimary: initialContacts.length === 0 })}>{addMutation.isPending ? "..." : t("add")}</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => { setAdding(false); setForm({ name: "", phone: "", relationship: "" }); }}>{tCommon("cancel")}</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setForm({ name: "", phone: "", relationship: "" }); }} className="w-full p-3 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors">
              {t("addCta")}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Multi-select for the traveler's spoken languages — what we tell hosts so
 * they can greet the guest in their tongue. NOT the same as the App
 * Language toggle in Settings (that one controls the UI locale via
 * `user.setLocale` + the next-intl router). Persisted to
 * `user_profiles.explicit_data.languages` via `user.setSpokenLanguages`.
 *
 * Optimistic local state is debounced into a single mutation when the row
 * collapses so a user picking three languages doesn't fire three writes.
 */
function SpokenLanguagesRow({ initial }: { initial: SpokenLanguage[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SpokenLanguage[]>(initial);
  const utils = trpc.useUtils();
  const t = useTranslations("profile.spokenLanguages");
  const setMutation = trpc.user.setSpokenLanguages.useMutation({
    onSuccess: () => {
      utils.user.getProfile.invalidate();
      toast.success(t("toastSaved"));
    },
    onError: () => toast.error(t("toastError")),
  });

  // Hydrate when the parent query resolves on first paint.
  useEffect(() => {
    setSelected(initial);
    // We intentionally only sync from the server snapshot; depending on the
    // array identity is enough because parents memoise via the tRPC cache.
  }, [initial]);

  function toggle(lang: SpokenLanguage) {
    setSelected((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function handleClose() {
    setOpen(false);
    // Only fire when the selection actually changed.
    const a = [...selected].sort().join("|");
    const b = [...initial].sort().join("|");
    if (a !== b) setMutation.mutate({ languages: selected });
  }

  const summary =
    selected.length === 0
      ? t("summaryEmpty")
      : selected.length <= 2
      ? selected.join(", ")
      : t("summaryCount", { count: selected.length });

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? handleClose() : setOpen(true))}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/60 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-card/50 flex items-center justify-center text-sm">💬</div>
        <div className="flex-1 min-w-0">
          <span className="block text-sm lg:text-base font-medium">{t("title")}</span>
          <span className="block text-xs text-muted-foreground">{t("subtitle")}</span>
        </div>
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[40%] text-right">{summary}</span>
        <svg className={`w-4 h-4 text-muted-foreground/40 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
          {SPOKEN_LANGUAGES.map((l) => {
            const active = selected.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(l)}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 justify-center ${
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {active && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemberBadge({ tourCount }: { tourCount: number }) {
  const t = useTranslations("profile.memberTier");
  const count = Math.max(0, tourCount || 0);
  const tier = count >= 5
    ? { key: "vip", bg: "bg-primary", icon: "👑" }
    : count >= 3
    ? { key: "premium", bg: "bg-secondary", icon: "⭐" }
    : count >= 1
    ? { key: "member", bg: "bg-secondary/80", icon: "✓" }
    : { key: "explorer", bg: "bg-muted-foreground/40", icon: "🌱" };
  const label = t(tier.key as "vip" | "premium" | "member" | "explorer");

  return (
    <Badge className={`${tier.bg} text-white border-0 text-xs mt-1.5 uppercase tracking-wider font-semibold px-3`} aria-label={label}>
      <span aria-hidden="true">{tier.icon}</span> {label}
    </Badge>
  );
}
