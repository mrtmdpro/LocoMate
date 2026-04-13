"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { data: tourHistory, isLoading } = trpc.tour.getHistory.useQuery();

  const paidTours = (tourHistory || []).filter((t) => t.status === "completed" || t.status === "paid");
  const totalSpent = paidTours.reduce((sum, t) => sum + (t.priceAmount || 0), 0);

  return (
    <div className="pb-24 min-h-screen bg-[#f2f8f7]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-[#3f6f60]">Payment History</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Summary Card */}
        <Card className="border-0 bg-[#3f6f60] text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/70">Total Spent</p>
                <p className="text-2xl font-bold font-heading">{totalSpent.toLocaleString()} VND</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/70">Transactions</p>
                <p className="text-2xl font-bold font-heading">{paidTours.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
        ) : paidTours.length === 0 ? (
          <div className="pt-12 text-center">
            <div className="text-5xl mb-4">💳</div>
            <h2 className="text-xl font-bold font-heading text-[#3f6f60]">No payments yet</h2>
            <p className="text-sm text-muted-foreground mt-2">Your transaction history will appear here</p>
            <Button onClick={() => router.push("/plan")} className="mt-6 bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl px-8">
              Plan a Tour
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {paidTours.map((tour) => {
              const td = tour.tourData as { title?: string } | null;
              const date = tour.completedAt || tour.createdAt;
              const isRefunded = false;

              return (
                <Card key={tour.id} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#ff8c30]/10 flex items-center justify-center text-lg shrink-0">
                      {tour.packageType === "solo_mate" ? "👤" : tour.packageType === "social_tour" ? "👥" : "🗺"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{td?.title || "Hanoi Tour"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">{date ? new Date(date).toLocaleDateString() : ""}</p>
                        <span className="text-[10px] text-muted-foreground">&middot;</span>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                          <span className="text-[10px] text-muted-foreground capitalize">{tour.packageType?.replaceAll("_", " ") || "route"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#3f6f60]">{(tour.priceAmount || 0).toLocaleString()}</p>
                      <p className="text-[8px] text-muted-foreground">VND</p>
                      <Badge className={`mt-1 border-0 text-[8px] ${isRefunded ? "bg-red-50 text-red-500" : "bg-[#90D26D]/10 text-[#3f6f60]"}`}>
                        {isRefunded ? "Refunded" : "Succeeded"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
