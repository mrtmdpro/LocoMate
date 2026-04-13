"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export default function SecurityPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [twoFA, setTwoFA] = useState(false);

  return (
    <div className="pb-24 min-h-screen bg-[#f2f8f7]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-[#3f6f60]">Security</h1>
      </div>

      <div className="px-4 space-y-5">
        {/* Password */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Password</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-[10px] text-muted-foreground">Last changed: Never</p>
                </div>
                <Button size="sm" className="h-8 text-xs bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-lg" onClick={() => toast.info("Password change coming soon")}>
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two-Factor Authentication */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Two-Factor Authentication</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-sm font-medium">Enable 2FA</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Secure your account with an extra layer of protection</p>
                </div>
                <Switch checked={twoFA} onCheckedChange={(v) => { setTwoFA(v); toast.success(v ? "2FA enabled" : "2FA disabled"); }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Login Sessions */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Login Sessions</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {[
                { device: "Current Browser", location: "Hanoi, Vietnam", time: "Active now", current: true },
                { device: "Mobile Safari", location: "Ho Chi Minh City", time: "2 hours ago", current: false },
              ].map((session, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#3f6f60]/10 flex items-center justify-center text-sm">
                        {session.current ? "💻" : "📱"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{session.device}</p>
                          {session.current && <Badge className="bg-[#90D26D] text-white border-0 text-[8px]">Current</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{session.location} &middot; {session.time}</p>
                      </div>
                    </div>
                    {!session.current && (
                      <button onClick={() => toast.success("Session signed out")} className="text-xs text-red-500 font-medium">
                        Sign out
                      </button>
                    )}
                  </div>
                  {i === 0 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Identity Verification */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Identity Verification</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#90D26D]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#90D26D]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Identity</p>
                    <Badge className="bg-[#90D26D]/10 text-[#3f6f60] border-0 text-[8px] mt-0.5">Verified</Badge>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => toast.info("Identity management coming soon")}>
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
