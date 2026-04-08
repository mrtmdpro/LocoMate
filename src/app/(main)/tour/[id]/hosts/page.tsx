"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";

export default function HostSelectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: hosts, isLoading } = trpc.host.getAvailableHosts.useQuery({ interests: [] });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold font-heading text-[#3f6f60]">Find Your Host</h1>
          <p className="text-xs text-muted-foreground">Verified Hanoi insiders matched to your style</p>
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
        const matchReason = (h.specialties || []).length > 0
          ? `Matches your interest in ${(h.specialties || []).slice(0, 2).join(" & ")}`
          : "Great overall match";

        return (
          <Card key={h.id} className="border-0 shadow-md overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-[#3f6f60] to-[#90D26D]" />
            <CardContent className="p-4 -mt-10">
              <div className="flex items-end gap-3 mb-3">
                <Avatar className="w-16 h-16 border-4 border-white shadow-md">
                  {h.avatarUrl && <AvatarImage src={h.avatarUrl} alt={h.displayName || ""} />}
                  <AvatarFallback className="bg-[#ff8c30] text-white text-xl font-bold">{(h.displayName || "?")[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#3f6f60]">{h.displayName}</h3>
                    {h.verificationStatus === "approved" && (
                      <Badge className="bg-[#90D26D] text-white border-0 text-[10px]">Verified</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">★ {Number(h.avgRating).toFixed(1)} &middot; {h.totalReviews} reviews &middot; {h.totalTours} tours</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{h.bio}</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {(h.specialties || []).map((s: string) => (
                  <Badge key={s} variant="outline" className="text-[10px] capitalize">{s}</Badge>
                ))}
                {langs.map((l: string) => (
                  <Badge key={l} className="bg-[#3f6f60]/10 text-[#3f6f60] border-0 text-[10px]">{l}</Badge>
                ))}
              </div>

              <div className="bg-[#ff8c30]/5 border border-[#ff8c30]/10 rounded-lg p-2 mb-3">
                <p className="text-xs text-[#ff8c30] font-medium">✨ {matchReason}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#3f6f60]">+500,000 VND</span>
                <Button
                  className="bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl text-sm"
                  onClick={() => router.push(`/tour/${id}/checkout`)}
                >
                  Select Host
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
