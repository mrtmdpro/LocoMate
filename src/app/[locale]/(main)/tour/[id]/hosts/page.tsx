"use client";

import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { TOUR_PRICING } from "@/lib/pricing";

export default function HostSelectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: hosts, isLoading } = trpc.host.getAvailableHosts.useQuery({ interests: [] });

  const assignHost = trpc.tour.assignHost.useMutation({
    onSuccess: () => {
      router.push(`/tour/${id}/checkout`);
    },
    onError: (err) => {
      toast.error(err.message || "Could not select that host. Please try another.");
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">Find Your Host</h1>
          <p className="text-xs text-muted-foreground">Verified Hanoi insiders tailored to your style</p>
        </div>
      </div>

      {hosts?.map((host) => {
        const h = host as {
          id: string;
          displayName: string;
          avatarUrl: string | null;
          bio: string | null;
          languages: unknown;
          specialties: string[] | null;
          avgRating: string | null;
          totalReviews: number | null;
          totalTours: number | null;
          verificationStatus: string | null;
        };
        const langs = Array.isArray(h.languages) ? h.languages : [];
        const fitReason = (h.specialties || []).length > 0
          ? `Perfect fit for your interest in ${(h.specialties || []).slice(0, 2).join(" & ")}`
          : "Great overall fit";

        return (
          <Card key={h.id} className="border-0 shadow-md overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-secondary to-[#A8C589]" />
            <CardContent className="p-4 -mt-10">
              <div className="flex items-end gap-3 mb-3">
                <Avatar className="w-16 h-16 border-4 border-white shadow-md">
                  {h.avatarUrl && <AvatarImage src={h.avatarUrl} alt={h.displayName || ""} />}
                  <AvatarFallback className="bg-primary text-white text-xl font-bold">{(h.displayName || "?")[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-secondary">{h.displayName}</h3>
                    {h.verificationStatus === "approved" && (
                      <Badge className="bg-sage text-earth border-0 text-xs">Verified</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">★ {Number(h.avgRating).toFixed(1)} &middot; {h.totalReviews} reviews &middot; {h.totalTours} tours</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{h.bio}</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {(h.specialties || []).map((s: string) => (
                  <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>
                ))}
                {langs.map((l: string) => (
                  <Badge key={l} className="bg-secondary/10 text-foreground border-0 text-xs">{l}</Badge>
                ))}
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 mb-3">
                <p className="text-sm text-primary font-semibold">✨ {fitReason}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary">+{TOUR_PRICING.hostAddon.toLocaleString()} {TOUR_PRICING.currency}</span>
                <Button
                  className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl text-sm disabled:opacity-60"
                  disabled={assignHost.isPending}
                  onClick={() => assignHost.mutate({ tourId: id, hostId: h.id })}
                >
                  {assignHost.isPending && assignHost.variables?.hostId === h.id ? "Selecting..." : "Select Host"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(!hosts || hosts.length === 0) && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hosts available right now.</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => router.back()}>Continue without host</Button>
        </div>
      )}
    </div>
  );
}
