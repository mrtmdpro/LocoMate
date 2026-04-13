"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function TourHistoryPage() {
  const router = useRouter();
  const { data: tourHistory, isLoading } = trpc.tour.getHistory.useQuery();

  const completedTours = (tourHistory || []).filter((t) => t.status === "completed");

  const grouped: Record<string, typeof completedTours> = {};
  for (const tour of completedTours) {
    const date = tour.completedAt ? new Date(tour.completedAt) : new Date();
    const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(tour);
  }

  return (
    <div className="pb-24 min-h-screen">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-[#3f6f60]">My Adventures</h1>
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : completedTours.length === 0 ? (
        <div className="px-4 pt-16 text-center">
          <div className="text-5xl mb-4">🗺</div>
          <h2 className="text-xl font-bold font-heading text-[#3f6f60]">No tours yet</h2>
          <p className="text-sm text-muted-foreground mt-2">Plan your first adventure in Hanoi!</p>
          <Button onClick={() => router.push("/plan")} className="mt-6 bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl px-8">
            Plan a Tour
          </Button>
        </div>
      ) : (
        <div className="px-4 space-y-5">
          {Object.entries(grouped).map(([month, tours]) => (
            <div key={month}>
              <p className="text-xs text-muted-foreground font-medium mb-2 px-1">{month}</p>
              <div className="space-y-3">
                {tours.map((tour) => {
                  const td = tour.tourData as { title?: string; stops?: { name: string }[] } | null;
                  const date = tour.completedAt ? new Date(tour.completedAt) : null;
                  return (
                    <Link key={tour.id} href={`/tour/${tour.id}`}>
                      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                        <div className="flex">
                          <div className="w-24 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] flex items-center justify-center shrink-0">
                            <span className="text-2xl">🗺</span>
                          </div>
                          <CardContent className="p-3 flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-[#3f6f60] truncate">{td?.title || "Hanoi Tour"}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {date?.toLocaleDateString()} &middot; {td?.stops?.length || 0} stops
                            </p>
                            <div className="flex items-center gap-1 mt-1.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <span key={s} className="text-[10px] text-[#ff8c30]">★</span>
                              ))}
                            </div>
                            <Badge className="bg-[#90D26D]/10 text-[#3f6f60] border-0 text-[8px] mt-1">Completed</Badge>
                          </CardContent>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
