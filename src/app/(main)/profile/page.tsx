"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data } = trpc.user.getProfile.useQuery();
  const { data: tourHistory } = trpc.tour.getHistory.useQuery();

  const profile = data?.profile;
  const derived = (profile?.derivedData || {}) as {
    personality?: Record<string, number>;
    emotional?: Record<string, number>;
  };

  const topTraits = Object.entries(derived.personality || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ name: k, value: Math.round(v * 100) }));

  const personalityLabel = topTraits.length > 0
    ? topTraits[0].name === "curiosity" ? "The Curious Explorer"
    : topTraits[0].name === "extroversion" ? "The Social Discoverer"
    : topTraits[0].name === "depth" ? "The Deep Diver"
    : "The Hanoi Adventurer"
    : "Complete onboarding to see your personality";

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Profile Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#ff8c30] to-[#e67a20]" />
        <CardContent className="p-4 -mt-12">
          <div className="flex items-end gap-4">
            <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
              <AvatarFallback className="bg-[#3f6f60] text-white text-2xl font-bold">
                {(user?.displayName || "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-bold font-[family-name:var(--font-sora)] text-[#3f6f60]">{user?.displayName}</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge className="bg-[#ff8c30]/10 text-[#ff8c30] border-[#ff8c30]/20 mt-1 text-xs capitalize">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Travel Identity */}
      <Card className="border-[#ff8c30]/10 bg-gradient-to-r from-[#ff8c30]/5 to-[#D9EDBF]/30">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#ff8c30] mb-1">Your Travel Personality</h3>
          <p className="text-lg font-bold text-[#3f6f60] font-[family-name:var(--font-sora)]">{personalityLabel}</p>
          {topTraits.length > 0 && (
            <div className="flex gap-2 mt-3">
              {topTraits.map((t) => (
                <Badge key={t.name} variant="outline" className="text-xs capitalize">
                  {t.name} {t.value}%
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tours", value: tourHistory?.length || 0 },
          { label: "Places", value: "12" },
          { label: "Friends", value: "3" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-[#3f6f60]">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settings Sections */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {[
            { label: "Tour History", icon: "📋", action: () => {} },
            { label: "Saved Places", icon: "❤️", action: () => {} },
            { label: "Emergency Contacts", icon: "🆘", action: () => {} },
          ].map((item, i) => (
            <div key={item.label}>
              <button onClick={item.action} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
              {i < 2 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {[
            { label: "Language", detail: "English", icon: "🌐" },
            { label: "Security", detail: "", icon: "🔒" },
            { label: "Payment History", detail: "", icon: "💳" },
          ].map((item, i) => (
            <div key={item.label}>
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.detail && <span className="text-xs text-muted-foreground">{item.detail}</span>}
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
              {i < 2 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={handleLogout} className="w-full rounded-xl text-red-500 border-red-200 hover:bg-red-50">
        Sign Out
      </Button>
    </div>
  );
}
