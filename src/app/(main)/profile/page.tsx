"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data, isLoading: profileLoading } = trpc.user.getProfile.useQuery();
  const { data: tourHistory } = trpc.tour.getHistory.useQuery();
  const { data: contacts } = trpc.user.getEmergencyContacts.useQuery();
  const { data: matches } = trpc.match.getMatches.useQuery();

  const profile = data?.profile;
  const derived = (profile?.derivedData || {}) as {
    personality?: Record<string, number>;
    personalityLabel?: string;
  };
  const explicit = (profile?.explicitData || {}) as {
    intent?: string[]; interests?: string[]; budget?: string;
    style?: { chill_explore?: number; plan_spontaneous?: number };
    social_preference?: string; time_preference?: string[];
  };

  if (profileLoading) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center justify-between"><div className="w-6 h-6 bg-gray-200 rounded animate-pulse" /><div className="h-5 w-14 bg-gray-200 rounded animate-pulse" /><div className="w-6 h-6 bg-gray-200 rounded animate-pulse" /></div>
        <div className="flex flex-col items-center pt-4"><div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse" /><div className="h-5 w-32 bg-gray-200 rounded mt-3 animate-pulse" /><div className="h-4 w-24 bg-gray-100 rounded mt-2 animate-pulse" /></div>
        <div className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3"><div className="h-16 bg-gray-100 rounded-xl animate-pulse" /><div className="h-16 bg-gray-100 rounded-xl animate-pulse" /><div className="h-16 bg-gray-100 rounded-xl animate-pulse" /></div>
      </div>
    );
  }

  const topTraits = Object.entries(derived.personality || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ name: k, value: Math.round(v * 100) }));

  const personalityLabel = derived.personalityLabel || "The Hanoi Adventurer";
  const matchScore = topTraits.length > 0 ? Math.round(topTraits.reduce((s, t) => s + t.value, 0) / topTraits.length) : 75;

  const completedTours = (tourHistory || []).filter((t) => t.status === "completed");
  const placesVisited = new Set(completedTours.flatMap((t) => {
    const td = t.tourData as { stops?: { placeId: string }[] } | null;
    return (td?.stops || []).map((s) => s.placeId);
  })).size;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="pb-24 bg-[#FAFAF8]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="font-semibold text-[#3f6f60]">Profile</h1>
        <Link href="/settings" aria-label="App settings" className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </Link>
      </div>

      {/* Centered Avatar + Name */}
      <div className="flex flex-col items-center px-4 pt-2 pb-4">
        <div className="relative">
          <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
            <AvatarFallback className="bg-[#3f6f60] text-white text-3xl font-bold">
              {(user?.displayName || "?")[0]}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#90D26D] border-2 border-white rounded-full" />
        </div>
        <h2 className="text-xl font-bold font-heading text-[#3f6f60] mt-3">{user?.displayName}</h2>
        <Badge className="bg-[#3f6f60] text-white border-0 text-[10px] mt-1.5 uppercase tracking-wider font-semibold px-3">Premium Member</Badge>
      </div>

      <div className="px-4 space-y-4">
        {/* Travel Personality Card - Dark Teal */}
        <Card className="border-0 bg-[#3f6f60] text-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
              </div>
              <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Travel Personality</span>
            </div>
            <h3 className="text-xl font-bold font-heading">{personalityLabel}</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#ff8c30] rounded-full transition-all" style={{ width: `${matchScore}%` }} />
              </div>
              <span className="text-xs font-semibold text-[#ff8c30]">{matchScore}% Local Match</span>
            </div>
          </CardContent>
        </Card>

        {/* My Preferences */}
        <Link href="/profile/preferences">
          <Card className="border border-[#ff8c30]/20 bg-[#ff8c30]/5 shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ff8c30]/10 flex items-center justify-center text-sm">✏️</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#ff8c30]">My Preferences</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {(explicit.intent ?? []).slice(0, 2).join(", ") || "Set your travel style"} &middot; {explicit.budget || "budget"} &middot; {(explicit.social_preference || "solo").replaceAll("_", " ")}
                </p>
              </div>
              <svg className="w-4 h-4 text-[#ff8c30]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </CardContent>
          </Card>
        </Link>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "SAVED PLACES", value: placesVisited },
            { label: "TOURS TAKEN", value: completedTours.length },
            { label: "LOCAL FRIENDS", value: matches?.length || 0 },
          ].map((stat) => (
            <Card key={stat.label} className="border border-gray-100 shadow-none">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-[#3f6f60]">{stat.value}</p>
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PERSONAL Section */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2 px-1">Personal</p>
          <Card className="border border-gray-100 shadow-none">
            <CardContent className="p-0">
              <EmergencyContactsRow contacts={contacts || []} />
              <Separator />
              <LanguageRow />
            </CardContent>
          </Card>
        </div>

        {/* ACTIVITY Section */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2 px-1">Activity</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/saved">
              <Card className="border border-gray-100 shadow-none overflow-hidden cursor-pointer hover:shadow-sm transition-shadow">
                <div className="h-24 bg-gradient-to-br from-[#D9EDBF] to-[#90D26D]/30 flex items-center justify-center">
                  <div className="text-2xl">📍</div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-semibold text-[#3f6f60]">Saved Places</p>
                  <p className="text-[10px] text-muted-foreground">{placesVisited} items</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/tours">
              <Card className="border border-gray-100 shadow-none overflow-hidden cursor-pointer hover:shadow-sm transition-shadow">
                <div className="h-24 bg-gradient-to-br from-[#3f6f60] to-[#2d5a4d] flex items-center justify-center">
                  <div className="text-center text-white">
                    <p className="text-[8px] uppercase tracking-wider opacity-70">Tour History</p>
                    <p className="text-lg font-heading font-bold">🗺</p>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-semibold text-[#3f6f60]">Tour History</p>
                  <p className="text-[10px] text-muted-foreground">{completedTours.length} completed</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* ACCOUNT & SECURITY Section */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2 px-1">Account & Security</p>
          <Card className="border border-gray-100 shadow-none">
            <CardContent className="p-0">
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#ff8c30]/10 flex items-center justify-center text-sm">🔒</div>
                <span className="flex-1 text-sm font-medium">Security Settings</span>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
              <Separator />
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#ff8c30]/10 flex items-center justify-center text-sm">💳</div>
                <span className="flex-1 text-sm font-medium">Payment History</span>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </CardContent>
          </Card>
        </div>

        <Button variant="outline" onClick={handleLogout} className="w-full rounded-xl text-red-500 border-red-200 hover:bg-red-50">
          Sign Out
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

  const addMutation = trpc.user.setEmergencyContact.useMutation({
    onSuccess: () => { utils.user.getEmergencyContacts.invalidate(); setAdding(false); setForm({ name: "", phone: "", relationship: "" }); toast.success("Contact added"); },
  });
  const updateMutation = trpc.user.updateEmergencyContact.useMutation({
    onSuccess: () => { utils.user.getEmergencyContacts.invalidate(); setEditing(null); toast.success("Contact updated"); },
  });
  const deleteMutation = trpc.user.deleteEmergencyContact.useMutation({
    onSuccess: () => { utils.user.getEmergencyContacts.invalidate(); toast.success("Contact removed"); },
  });

  function startEdit(c: typeof initialContacts[0]) {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone, relationship: c.relationship || "" });
  }

  return (
    <>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-sm">🆘</div>
        <span className="flex-1 text-sm font-medium">Emergency Contacts</span>
        <Badge variant="outline" className="text-[10px]">{initialContacts.length}</Badge>
        <svg className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {initialContacts.map((c) =>
            editing === c.id ? (
              <div key={c.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs rounded-lg" /></div>
                  <div><Label className="text-[10px]">Relationship</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="e.g. Mother" /></div>
                </div>
                <div><Label className="text-[10px]">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs rounded-lg" /></div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-[10px] bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-lg" disabled={!form.name || !form.phone || updateMutation.isPending} onClick={() => updateMutation.mutate({ id: c.id, name: form.name, phone: form.phone, relationship: form.relationship || undefined })}>{updateMutation.isPending ? "..." : "Save"}</Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg text-red-500 border-red-200 ml-auto" onClick={() => deleteMutation.mutate({ id: c.id })}>Delete</Button>
                </div>
              </div>
            ) : (
              <div key={c.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg group">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-xs">👤</div>
                <div className="flex-1 min-w-0"><p className="text-xs font-medium">{c.name}</p><p className="text-[10px] text-muted-foreground">{c.relationship} &middot; {c.phone}</p></div>
                {c.isPrimary && <Badge className="bg-red-50 text-red-600 border-0 text-[10px]">Primary</Badge>}
                <button onClick={() => startEdit(c)} className="opacity-0 group-hover:opacity-100 text-[10px] text-[#ff8c30] font-medium transition-opacity">Edit</button>
              </div>
            )
          )}
          {adding ? (
            <div className="p-3 bg-[#ff8c30]/5 border border-[#ff8c30]/20 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-[#3f6f60]">Add contact</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="Contact name" /></div>
                <div><Label className="text-[10px]">Relationship</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="e.g. Friend" /></div>
              </div>
              <div><Label className="text-[10px]">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="+84..." /></div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-[10px] bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-lg" disabled={!form.name || !form.phone || addMutation.isPending} onClick={() => addMutation.mutate({ name: form.name, phone: form.phone, relationship: form.relationship || undefined, isPrimary: initialContacts.length === 0 })}>{addMutation.isPending ? "..." : "Add"}</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg" onClick={() => { setAdding(false); setForm({ name: "", phone: "", relationship: "" }); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setForm({ name: "", phone: "", relationship: "" }); }} className="w-full p-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-muted-foreground hover:border-[#ff8c30]/30 hover:text-[#ff8c30] transition-colors">
              + Add emergency contact
            </button>
          )}
        </div>
      )}
    </>
  );
}

function LanguageRow() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("English");
  const languages = ["English", "Tiếng Việt", "日本語", "한국어", "Français", "Español", "中文"];

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-[#D9EDBF]/50 flex items-center justify-center text-sm">🌐</div>
        <span className="flex-1 text-sm font-medium">Language</span>
        <span className="text-xs text-muted-foreground">{lang}</span>
        <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
          {languages.map((l) => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false); toast.success(`Language set to ${l}`); }}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                lang === l ? "bg-[#3f6f60] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
