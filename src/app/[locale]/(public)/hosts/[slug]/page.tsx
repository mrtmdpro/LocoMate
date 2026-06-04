"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { pickLocaleField } from "@/lib/pick-locale-field";
import type { Locale } from "@/i18n/routing";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { formatDateLong, formatVndPrice } from "@/lib/format";
import { hostExperienceImage } from "@/lib/host-experience-images";

export default function HostProfilePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { user } = useAuthStore();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.host.getPublicProfile.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug, retry: false },
  );

  const hostId = data?.host.id;
  const { data: isSaved } = trpc.host.isSaved.useQuery(
    { hostId: hostId ?? "" },
    { enabled: !!user && !!hostId },
  );

  const save = trpc.host.save.useMutation({
    onSuccess: () => {
      toast.success("Host saved");
      if (hostId) utils.host.isSaved.invalidate({ hostId });
      utils.host.getSaved.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Could not save"),
  });

  const unsave = trpc.host.unsave.useMutation({
    onSuccess: () => {
      toast.success("Removed");
      if (hostId) utils.host.isSaved.invalidate({ hostId });
      utils.host.getSaved.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Could not unsave"),
  });

  const startChat = trpc.chat.startWithHost.useMutation({
    onSuccess: ({ matchId }) => {
      router.push(`/chat/${matchId}`);
    },
    onError: (err) => toast.error(err.message ?? "Could not open chat"),
  });

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-60 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-8 text-center text-sm space-y-3">
        <div className="text-4xl">🕵️</div>
        <p className="text-foreground font-semibold">Host not found</p>
        <Link href="/hosts" className="text-primary text-xs font-medium">
          Browse all hosts →
        </Link>
      </div>
    );
  }

  const { host, experiences, activities } = data;
  const hasRating = Number(host.avgRating ?? 0) > 0;
  const ratingLabel = hasRating ? Number(host.avgRating).toFixed(1) : "New";
  // Bilingual bio: prefer current locale's bio, fall back to the other,
  // then the legacy single-language column.
  const hostBio = pickLocaleField<string>(host, "bio", locale) ?? host.bio ?? null;

  const handleSave = () => {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/hosts/${params.slug}`)}`);
      return;
    }
    if (isSaved) {
      unsave.mutate({ hostId: host.id });
    } else {
      save.mutate({ hostId: host.id });
    }
  };

  const handleMessage = () => {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/hosts/${params.slug}`)}`);
      return;
    }
    startChat.mutate({ hostUserId: host.userId });
  };

  return (
    <PageTransition>
      <div className="pb-20 lg:pb-12 lg:max-w-6xl lg:mx-auto">
        {/* Hero band. Green gradient like the host dashboard header so the
            profile page reads as a host-branded surface rather than a generic
            traveler surface. */}
        <div className="h-32 lg:h-44 bg-gradient-to-br from-secondary to-[#A8C589] relative">
          <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/10181717/pexels-photo-10181717.jpeg?auto=compress&cs=tinysrgb&w=1600')] bg-cover bg-center opacity-15" aria-hidden />
          <Link href="/hosts" className="absolute top-4 left-4 w-11 h-11 rounded-full bg-card/90 hover:bg-card flex items-center justify-center transition-colors z-10" aria-label="Back to hosts">
            <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </Link>
        </div>

        {/* Main content. Single column on mobile, 2-col (content left,
            sticky sidebar right) at lg. */}
        <div className="px-4 lg:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-10 lg:items-start">

          <div className="space-y-4">
            {/* Identity block.
                Avatar is pulled up into the hero with a negative margin so
                it overlaps the green band (LinkedIn pattern). The name and
                metadata sit ENTIRELY below the hero so dark text never
                fights the dark-green hero image for contrast -- that was
                the "name hidden behind background image" bug. */}
            <div>
              <Avatar className="w-24 h-24 lg:w-32 lg:h-32 border-4 border-white shadow-lg -mt-12 lg:-mt-16 relative z-10">
                {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt={host.displayName} />}
                <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl lg:text-4xl font-bold">
                  {host.displayName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{host.displayName}</h1>
                  {host.verifiedAt && (
                    <Badge className="bg-secondary/10 text-foreground border-0 text-xs">
                      ✓ Verified host
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Local host in Hanoi
                  {host.memberSince && <> · Member since {formatDateLong(host.memberSince as unknown as string)}</>}
                </p>
                <div className="flex items-center gap-3 pt-0.5 text-sm">
                  <span className="font-semibold text-secondary">
                    {hasRating ? (
                      <>
                        <span aria-hidden>★</span> {ratingLabel}
                      </>
                    ) : (
                      <span>New host</span>
                    )}
                  </span>
                  {hasRating && <span className="text-muted-foreground">({host.totalReviews ?? 0} reviews)</span>}
                  {Number(host.totalTours ?? 0) > 0 && <span className="text-muted-foreground">· {host.totalTours} tours</span>}
                </div>
              </div>
            </div>

            {/* Mobile-only CTA row (desktop uses the sidebar) */}
            <div className="flex gap-2 lg:hidden">
              <Button
                onClick={handleMessage}
                disabled={startChat.isPending || user?.id === host.userId}
                className="flex-1 bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl h-11 font-bold"
              >
                {user?.id === host.userId ? "This is you" : startChat.isPending ? "Opening..." : "Message"}
              </Button>
              <Button
                onClick={handleSave}
                variant="outline"
                disabled={save.isPending || unsave.isPending || user?.id === host.userId}
                className="rounded-xl h-11 px-4"
              >
                {isSaved ? "Saved" : "Save"}
              </Button>
            </div>

            {/* About */}
            {hostBio && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 lg:p-5 space-y-2">
                  <h2 className="font-semibold text-base lg:text-lg text-foreground">About</h2>
                  <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line max-w-prose">{hostBio}</p>
                </CardContent>
              </Card>
            )}

            {/* Specialties + Languages */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 lg:p-5 space-y-4">
                {Array.isArray(host.specialties) && host.specialties.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(host.specialties as string[]).map((s) => (
                        <Badge key={s} className="bg-card text-foreground border-0 text-xs capitalize">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(host.languages) && host.languages.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Languages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(host.languages as string[]).map((l) => (
                        <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Experiences by this host */}
            {experiences.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-h2 text-foreground">Tours with {host.displayName.split(" ")[0]}</h2>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{experiences.length}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {experiences.map((e) => {
                    const photo =
                      hostExperienceImage(e.slug) ?? e.photos?.[0] ?? null;
                    const eTitle = pickLocaleField<string>(e, "title", locale) ?? e.title;
                    return (
                    <Link key={e.id} href={`/experiences/${e.slug}`} className="group">
                      <Card className="border-0 shadow-sm overflow-hidden transition-shadow group-hover:shadow-md">
                        <div className="h-36 bg-muted relative overflow-hidden">
                          {photo && (
                            <Image
                              src={photo}
                              alt={eTitle ?? ""}
                              fill
                              sizes="(max-width: 1024px) 100vw, 50vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          )}
                          <Badge className="absolute top-2 left-2 bg-card/90 text-foreground border-0 text-xs capitalize">{e.category}</Badge>
                        </div>
                        <CardContent className="p-3">
                          <p className="text-sm lg:text-base font-semibold text-foreground line-clamp-1">{eTitle}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-muted-foreground">
                              {Math.floor(e.durationMinutes / 60)}h{e.durationMinutes % 60 ? ` ${e.durationMinutes % 60}m` : ""}
                              {Number(e.avgRating) > 0 && ` · ★ ${Number(e.avgRating).toFixed(1)}`}
                            </p>
                            <p className="text-sm lg:text-base font-bold text-primary whitespace-nowrap">
                              {formatVndPrice(e.priceAmount)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Activities by this host */}
            {activities.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-h2 text-foreground">Activities with {host.displayName.split(" ")[0]}</h2>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{activities.length}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {activities.map((a) => {
                    const aTitle = pickLocaleField<string>(a, "title", locale) ?? a.title;
                    return (
                    <Link key={a.id} href={`/activities/${a.slug}`} className="group">
                      <Card className="border-0 shadow-sm overflow-hidden transition-shadow group-hover:shadow-md">
                        <div className="h-32 bg-card relative overflow-hidden">
                          {a.photos?.[0] && (
                            <Image
                              src={a.photos[0]}
                              alt={aTitle ?? ""}
                              fill
                              sizes="(max-width: 1024px) 100vw, 50vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          )}
                          <Badge className="absolute top-2 left-2 bg-card/90 text-foreground border-0 text-xs capitalize">{a.category}</Badge>
                        </div>
                        <CardContent className="p-3">
                          <p className="text-sm lg:text-base font-semibold text-foreground line-clamp-1">{aTitle}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-muted-foreground">
                              {Math.floor(a.durationMinutes / 60)}h{a.durationMinutes % 60 ? ` ${a.durationMinutes % 60}m` : ""}
                              {Number(a.avgRating) > 0 && ` · ★ ${Number(a.avgRating).toFixed(1)}`}
                            </p>
                            <p className="text-sm lg:text-base font-bold text-primary whitespace-nowrap">
                              {formatVndPrice(a.priceAmount)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {experiences.length === 0 && activities.length === 0 && (
              <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
                <CardContent className="p-8 text-center space-y-1">
                  <div className="text-3xl">🌱</div>
                  <p className="text-base font-medium text-foreground">
                    {host.displayName.split(" ")[0]} hasn&apos;t published a listing yet
                  </p>
                  <p className="text-sm text-muted-foreground">Check back soon.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Desktop-only sticky side panel */}
          <aside className="hidden lg:block pt-14">
            <div className="sticky top-20 space-y-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Availability</p>
                    <p className="text-base font-semibold text-foreground mt-1">
                      {host.isAvailable ? "Currently accepting bookings" : "On pause"}
                    </p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Button
                      onClick={handleMessage}
                      disabled={startChat.isPending || user?.id === host.userId}
                      className="w-full bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl h-11 font-bold"
                    >
                      {user?.id === host.userId
                        ? "This is your profile"
                        : startChat.isPending
                          ? "Opening..."
                          : `Message ${host.displayName.split(" ")[0]}`}
                    </Button>
                    <Button
                      onClick={handleSave}
                      variant="outline"
                      disabled={save.isPending || unsave.isPending || user?.id === host.userId}
                      className="w-full rounded-xl h-11"
                    >
                      {isSaved ? "★ Saved" : "Save host"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground pt-1">
                    {user?.id === host.userId
                      ? "This is your public profile. Manage it from your Host dashboard."
                      : "Typical response time: within a day."}
                  </p>
                </CardContent>
              </Card>

              {/* Quick stats tile */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{hasRating ? Number(host.avgRating).toFixed(1) : "—"}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Rating</p>
                  </div>
                  <div>
                    <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{host.totalReviews ?? 0}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Reviews</p>
                  </div>
                  <div>
                    <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{host.totalTours ?? 0}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Tours</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
