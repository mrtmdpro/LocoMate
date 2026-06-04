"use client";

import Image from "next/image";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AiExplainer } from "@/components/ai-explainer";
import { Label } from "@/components/ui/label";
import { PageTransition } from "@/components/layout/page-transition";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { formatVndPrice } from "@/lib/format";
import { HOST_TOUR_PRICING } from "@/lib/pricing";
import { hostExperienceImage } from "@/lib/host-experience-images";
import { pickLocaleField } from "@/lib/pick-locale-field";
import type { Locale } from "@/i18n/routing";

function todayVnIso(): string {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const vn = new Date(Date.now() + VN_OFFSET_MS);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, "0")}-${String(vn.getUTCDate()).padStart(2, "0")}`;
}

export default function ExperienceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { user } = useAuthStore();

  const { data: exp, isLoading } = trpc.experience.getBySlug.useQuery({ slug });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookDate, setBookDate] = useState(todayVnIso());
  const [bookStartTime, setBookStartTime] = useState("09:00");
  const [bookGroupSize, setBookGroupSize] = useState(1);
  const [bookError, setBookError] = useState("");

  const bookMutation = trpc.experience.book.useMutation({
    onSuccess: ({ tourId }) => {
      setDialogOpen(false);
      router.push(`/tour/${tourId}/checkout`);
    },
    onError: (err) => setBookError(err.message || "Could not book. Please try again."),
  });

  if (isLoading)
    return (
      <div className="p-4 space-y-4">
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
        <div className="h-40 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  if (!exp) return <div className="p-4 text-center">Experience not found</div>;

  // Bilingual content with graceful fallback through (locale-specific
  // → other locale → legacy single-language column).
  const title = pickLocaleField<string>(exp, "title", locale) ?? exp.title;
  const subtitle = pickLocaleField<string>(exp, "subtitle", locale) ?? exp.subtitle ?? "";
  const description = pickLocaleField<string>(exp, "description", locale) ?? exp.description ?? "";
  const highlights = (pickLocaleField<unknown>(exp, "highlights", locale) ?? exp.highlights ?? []) as string[];
  const included = (pickLocaleField<unknown>(exp, "included", locale) ?? exp.included ?? []) as string[];
  const schedule = (pickLocaleField<unknown>(exp, "schedule", locale) ?? exp.schedule ?? []) as { time: string; label: string }[];
  const hostBio = pickLocaleField<string>(exp, "hostBio", locale) ?? exp.hostBio ?? null;
  // For the seeded host experiences we prefer the brand cinematic
  // illustration; everything else falls back to the host's uploaded
  // photos as before.
  const photos = (exp.photos || []) as string[];
  const heroImage = hostExperienceImage(exp.slug) ?? photos[0] ?? null;

  const hasAuthor = exp.kind === "host_custom" && !!exp.authorDisplayName;
  const maxGroupSize = exp.maxGroupSize ?? 4;

  const handleBookClick = () => {
    if (!user) {
      router.push("/register");
      return;
    }
    setBookError("");
    setDialogOpen(true);
  };

  const handleConfirmBook = () => {
    setBookError("");
    if (bookGroupSize < 1 || bookGroupSize > maxGroupSize) {
      setBookError(`Group size must be between 1 and ${maxGroupSize}.`);
      return;
    }
    if (bookDate < todayVnIso()) {
      setBookError("Please pick today or a future date.");
      return;
    }
    bookMutation.mutate({
      experienceId: exp.id,
      date: bookDate,
      startTime: bookStartTime,
      groupSize: bookGroupSize,
    });
  };

  return (
    <PageTransition>
    <div className="pb-24 lg:pb-12">
      <div className="h-72 relative overflow-hidden bg-muted">
        {heroImage && <Image src={heroImage} alt={title ?? ""} fill sizes="100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button onClick={() => router.back()} className="absolute top-4 left-4 lg:top-6 lg:left-8 bg-card/90 rounded-full p-2 shadow-md z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        {/* Hero text strip — pinned to the bottom of the hero photo. The
            inner div caps width at `lg:max-w-5xl` and centres so the
            title aligns with the body column on desktop, matching the
            Safe Zone container pattern used by /fixed-tours/[id]. */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 lg:p-8 z-10 pointer-events-none">
          <div className="lg:max-w-5xl lg:mx-auto w-full">
            <div className="flex gap-1.5 mb-2">
              <Badge className="bg-primary border-0 text-primary-foreground text-xs capitalize">{exp.category}</Badge>
              {exp.kind === "host_custom" && (
                <Badge className="bg-secondary border-0 text-secondary-foreground text-xs">HOST-AUTHORED</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold font-heading text-white">&ldquo;{title}&rdquo;</h1>
            <p className="text-sm text-white/80 mt-1">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-8 -mt-4 relative lg:max-w-5xl lg:mx-auto space-y-4 lg:space-y-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-secondary">{exp.durationMinutes >= 60 ? `${Math.floor(exp.durationMinutes / 60)}h${exp.durationMinutes % 60 ? ` ${exp.durationMinutes % 60}m` : ""}` : `${exp.durationMinutes}m`}</p>
                <p className="text-xs text-muted-foreground uppercase">Duration</p>
              </div>
              <div>
                <p className="text-base lg:text-lg font-bold text-primary whitespace-nowrap">{formatVndPrice(exp.priceAmount)}</p>
                <p className="text-xs text-muted-foreground uppercase">Per person</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-yellow-500 text-sm">★</span>
                  <p className="text-lg font-bold text-secondary">{Number(exp.avgRating || 0).toFixed(1)}</p>
                </div>
                <p className="text-xs text-muted-foreground uppercase">{exp.totalBookings ?? 0} booked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasAuthor && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {(() => {
                const inner = (
                  <>
                    <Avatar className="w-12 h-12">
                      {exp.authorAvatarUrl && <AvatarImage src={exp.authorAvatarUrl} alt={exp.authorDisplayName ?? ""} />}
                      <AvatarFallback className="bg-primary text-white font-bold">
                        {(exp.authorDisplayName ?? "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">Your host</p>
                      <p className="text-sm font-semibold text-secondary">
                        {exp.authorDisplayName}
                        {exp.authorSlug && <span className="text-xs text-muted-foreground ml-1 font-normal">· View profile →</span>}
                      </p>
                      {hostBio && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{hostBio}</p>
                      )}
                    </div>
                    {exp.hostTotalReviews != null && exp.hostTotalReviews > 0 && (
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <div className="flex items-center gap-0.5">
                          <span className="text-yellow-500 text-sm">★</span>
                          <span className="font-bold text-secondary">{Number(exp.hostAvgRating || 0).toFixed(1)}</span>
                        </div>
                        <p>{exp.hostTotalReviews} reviews</p>
                      </div>
                    )}
                  </>
                );
                // Link to the host's public profile when we have a slug;
                // fallback to non-interactive div otherwise.
                return exp.authorSlug ? (
                  <Link
                    href={`/hosts/${exp.authorSlug}`}
                    className="p-4 flex items-center gap-3 hover:bg-muted/60 transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="p-4 flex items-center gap-3">{inner}</div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5">
            <h3 className="text-base lg:text-lg font-bold text-secondary mb-2">About this experience</h3>
            <p className="text-body text-muted-foreground max-w-prose">{description}</p>
          </CardContent>
        </Card>

        {/* AI explainer: explains fit, doesn't generate. Hides when there's
            no specific signal to report. */}
        <AiExplainer
          itemKind="experience"
          itemTitle={title ?? ""}
          itemCategory={exp.category}
          itemHighlights={highlights}
        />

        {highlights.length > 0 && (
          <Card className="border-0 bg-card/30">
            <CardContent className="p-4 lg:p-5">
              <h3 className="text-base lg:text-lg font-bold text-secondary mb-3">Highlights</h3>
              <div className="space-y-2">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[#A8C589] mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <p className="text-base text-secondary">{h}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {schedule.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 lg:p-5">
              <h3 className="text-base lg:text-lg font-bold text-secondary mb-3">Schedule</h3>
              <div className="space-y-3">
                {schedule.map((s, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-primary" : "bg-card"}`} />
                      {i < schedule.length - 1 && <div className="w-0.5 h-6 bg-muted/80" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary">{s.time}</p>
                      <p className="text-sm lg:text-base text-secondary">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {included.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 lg:p-5">
              <h3 className="text-base lg:text-lg font-bold text-secondary mb-3">What&apos;s Included</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {included.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/85 text-primary-foreground font-bold text-base shadow-lg"
          onClick={handleBookClick}
          data-testid="book-button"
        >
          {user ? `Book Now — ${formatVndPrice(exp.priceAmount)}` : "Sign up to book this experience"}
        </Button>

        {!user && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm font-semibold text-secondary">Create a free account to build your personalized Hanoi itinerary</p>
              <Link href="/register">
                <Button className="mt-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold rounded-xl px-6 text-sm">
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {exp.hostRequired && (
          <p className="text-center text-xs text-muted-foreground">
            This experience requires a local host. You&apos;ll be connected with your host via chat after booking.
          </p>
        )}
      </div>

      {/* Booking dialog: closes UI-04 + BIZ-02. Wires experience.book. */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          // ESC + backdrop also route through onOpenChange. If a mutation is
          // in flight (~1s on slow networks), ignoring the close keeps the
          // "Cancel" and "close-via-ESC" behaviors consistent and avoids a
          // navigate-to-checkout surprise after the user thought they cancelled.
          if (!open && bookMutation.isPending) return;
          setDialogOpen(open);
          if (!open) {
            setBookError("");
            setBookGroupSize(1);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book &ldquo;{title}&rdquo;</DialogTitle>
            <DialogDescription>
              Pick a date and time. Payment happens on the next step; nothing
              is charged yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="book-date">Date</Label>
              <Input
                id="book-date"
                type="date"
                min={todayVnIso()}
                value={bookDate}
                onChange={(e) => setBookDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-time">Start time</Label>
              <Input
                id="book-time"
                type="time"
                value={bookStartTime}
                onChange={(e) => setBookStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-group">Group size</Label>
              <Input
                id="book-group"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxGroupSize}
                step={1}
                value={bookGroupSize}
                onChange={(e) => {
                  // Clamp AND integer-round so `3.5` becomes 3 before the
                  // server sees it. Zod .int() would reject 3.5 with a
                  // cryptic error; clamp here for a saner UX.
                  const raw = Math.floor(Number(e.target.value) || 1);
                  setBookGroupSize(Math.max(1, Math.min(maxGroupSize, raw)));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Up to {maxGroupSize} travelers for this experience.
              </p>
            </div>
            <div className="rounded-lg bg-secondary/5 p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-secondary">
                {(exp.priceAmount * bookGroupSize).toLocaleString()} {HOST_TOUR_PRICING.currency}
              </span>
            </div>
            {bookError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
                {bookError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={bookMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/85 text-primary-foreground"
              onClick={handleConfirmBook}
              disabled={bookMutation.isPending}
              data-testid="confirm-book-button"
            >
              {bookMutation.isPending ? "Booking..." : "Continue to payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}
