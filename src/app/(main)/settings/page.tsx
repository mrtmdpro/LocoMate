"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);

  return (
    <div className="pb-24 bg-[#f2f8f7] min-h-screen">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-[#3f6f60]">Settings</h1>
      </div>

      <div className="px-4 space-y-5">
        {/* Account */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Account</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">Display Name</span>
                <span className="text-sm text-muted-foreground">{user?.displayName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">Email</span>
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
              <Separator />
              <button onClick={() => toast.info("Password change coming soon")} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium">Change Password</span>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Notifications</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">Push Notifications</span>
                <Switch checked={pushNotifs} onCheckedChange={setPushNotifs} />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">Email Digest</span>
                <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Privacy */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">Privacy</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">Location Sharing</span>
                <Switch checked={locationSharing} onCheckedChange={setLocationSharing} />
              </div>
              <Separator />
              <button onClick={() => toast.info("Data usage details coming soon")} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium">Data Usage</span>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* About */}
        <div>
          <p className="text-[10px] text-[#3f6f60] uppercase tracking-widest font-semibold mb-2 px-1">About</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-medium">Version</span>
                <span className="text-xs text-muted-foreground">1.0.0</span>
              </div>
              <Separator />
              {["Terms of Service", "Privacy Policy", "Licenses"].map((item, i) => (
                <div key={item}>
                  <button onClick={() => toast.info(`${item} page coming soon`)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-medium">{item}</span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </button>
                  {i < 2 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Button variant="outline" onClick={() => { logout(); router.push("/login"); }} className="w-full rounded-xl text-red-500 border-red-200 hover:bg-red-50">
          Delete Account
        </Button>
      </div>
    </div>
  );
}
