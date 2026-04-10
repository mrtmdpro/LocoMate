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
  const { data } = trpc.user.getProfile.useQuery();
  const { data: tourHistory } = trpc.tour.getHistory.useQuery();
  const { data: contacts } = trpc.user.getEmergencyContacts.useQuery();
  const { data: matches } = trpc.match.getMatches.useQuery();

  const [showTours, setShowTours] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const profile = data?.profile;
  const derived = (profile?.derivedData || {}) as {
    personality?: Record<string, number>;
    emotional?: Record<string, number>;
    personalityLabel?: string;
  };
  const explicit = (profile?.explicitData || {}) as {
    intent?: string[]; interests?: string[]; budget?: string;
    style?: { chill_explore?: number; plan_spontaneous?: number };
    social_preference?: string; time_preference?: string[];
  };

  const topTraits = Object.entries(derived.personality || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ name: k, value: Math.round(v * 100) }));

  const personalityLabel = derived.personalityLabel || (
    topTraits.length > 0
      ? topTraits[0].name === "curiosity" ? "The Deep Explorer"
      : topTraits[0].name === "extroversion" ? "The Social Butterfly"
      : topTraits[0].name === "energy" ? "The Thrill Seeker"
      : "The Hanoi Adventurer"
      : "Complete onboarding to see your personality"
  );

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
    <div className="p-4 space-y-4 pb-24">
      {/* Profile Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#ff8c30] to-[#e67a20]" />
        <CardContent className="p-4 -mt-12">
          <div className="flex items-end gap-4">
            <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
              <AvatarFallback className="bg-[#3f6f60] text-white text-2xl font-bold">
                {(user?.displayName || "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-bold font-heading text-[#3f6f60]">{user?.displayName}</h1>
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
          <p className="text-lg font-bold text-[#3f6f60] font-heading">{personalityLabel}</p>
          {topTraits.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {topTraits.map((t) => (
                <Badge key={t.name} variant="outline" className="text-xs capitalize">
                  {t.name} {t.value}%
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Preferences */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#3f6f60]">My Preferences</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowPrefs(!showPrefs)} className="text-xs text-muted-foreground">
                {showPrefs ? "Hide" : "Show"}
              </button>
              <Link href="/profile/preferences">
                <Badge className="bg-[#ff8c30] text-white border-0 text-[10px] cursor-pointer">Edit</Badge>
              </Link>
            </div>
          </div>
          {showPrefs && explicit.intent && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Travel goals</p>
                <div className="flex flex-wrap gap-1">{(explicit.intent || []).map((i) => <Badge key={i} variant="outline" className="text-[10px]">{i}</Badge>)}</div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Interests</p>
                <div className="flex flex-wrap gap-1">{(explicit.interests || []).map((i) => <Badge key={i} variant="outline" className="text-[10px]">{i}</Badge>)}</div>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</p>
                  <p className="font-medium capitalize">{explicit.budget || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Social</p>
                  <p className="font-medium capitalize">{(explicit.social_preference || "—").replace("_", " ")}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Best times</p>
                <div className="flex gap-1">{(explicit.time_preference || []).map((t) => <Badge key={t} variant="outline" className="text-[10px] capitalize">{t.replace("_", " ")}</Badge>)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-[10px] text-muted-foreground">Chill ↔ Explore</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div className="bg-[#ff8c30] h-1.5 rounded-full" style={{ width: `${(explicit.style?.chill_explore || 0.5) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Plan ↔ Spontaneous</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div className="bg-[#3f6f60] h-1.5 rounded-full" style={{ width: `${(explicit.style?.plan_spontaneous || 0.5) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          {!showPrefs && explicit.intent && (
            <div className="flex flex-wrap gap-1">
              {(explicit.intent || []).slice(0, 3).map((i) => <Badge key={i} variant="outline" className="text-[10px]">{i}</Badge>)}
              <Badge variant="outline" className="text-[10px] capitalize">{explicit.budget}</Badge>
              <Badge variant="outline" className="text-[10px] capitalize">{(explicit.social_preference || "").replace("_", " ")}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tours", value: completedTours.length },
          { label: "Places", value: placesVisited },
          { label: "Friends", value: matches?.length || 0 },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-[#3f6f60]">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tour History */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <button onClick={() => setShowTours(!showTours)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
            <span className="text-lg">📋</span>
            <span className="flex-1 text-sm font-medium">Tour History</span>
            <Badge variant="outline" className="text-[10px]">{completedTours.length}</Badge>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showTours ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
          {showTours && completedTours.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              {completedTours.map((tour) => {
                const td = tour.tourData as { title?: string; stops?: unknown[] } | null;
                return (
                  <div key={tour.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-lg bg-[#ff8c30]/10 flex items-center justify-center text-xs">🗺</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{td?.title || "Hanoi Tour"}</p>
                      <p className="text-[10px] text-muted-foreground">{td?.stops?.length || 0} stops &middot; {tour.completedAt ? new Date(tour.completedAt).toLocaleDateString() : ""}</p>
                    </div>
                    <Badge className="bg-[#90D26D]/10 text-[#3f6f60] border-0 text-[10px]">Completed</Badge>
                  </div>
                );
              })}
            </div>
          )}
          {showTours && completedTours.length === 0 && (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No tours yet. Plan your first one!</p>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <EmergencyContactsSection contacts={contacts || []} />

      {/* Settings */}
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

function EmergencyContactsSection({ contacts: initialContacts }: { contacts: { id: string; name: string; phone: string; relationship: string | null; isPrimary: boolean | null }[] }) {
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
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
          <span className="text-lg">🆘</span>
          <span className="flex-1 text-sm font-medium">Emergency Contacts</span>
          <Badge variant="outline" className="text-[10px]">{initialContacts.length}</Badge>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-2">
            {initialContacts.map((c) => (
              editing === c.id ? (
                <div key={c.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Name</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Relationship</Label>
                      <Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="e.g. Mother" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs rounded-lg" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-[10px] bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-lg" disabled={!form.name || !form.phone || updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: c.id, name: form.name, phone: form.phone, relationship: form.relationship || undefined })}>
                      {updateMutation.isPending ? "..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg text-red-500 border-red-200 ml-auto" onClick={() => deleteMutation.mutate({ id: c.id })}>
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg group">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-xs">👤</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.relationship} &middot; {c.phone}</p>
                  </div>
                  {c.isPrimary && <Badge className="bg-red-50 text-red-600 border-0 text-[10px]">Primary</Badge>}
                  <button onClick={() => startEdit(c)} className="opacity-0 group-hover:opacity-100 text-[10px] text-[#ff8c30] font-medium transition-opacity">Edit</button>
                </div>
              )
            ))}

            {adding ? (
              <div className="p-3 bg-[#ff8c30]/5 border border-[#ff8c30]/20 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-[#3f6f60]">Add contact</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="Contact name" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Relationship</Label>
                    <Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="e.g. Friend" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="+84..." />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-[10px] bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-lg" disabled={!form.name || !form.phone || addMutation.isPending}
                    onClick={() => addMutation.mutate({ name: form.name, phone: form.phone, relationship: form.relationship || undefined, isPrimary: initialContacts.length === 0 })}>
                    {addMutation.isPending ? "..." : "Add"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg" onClick={() => { setAdding(false); setForm({ name: "", phone: "", relationship: "" }); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAdding(true); setForm({ name: "", phone: "", relationship: "" }); }}
                className="w-full p-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-muted-foreground hover:border-[#ff8c30]/30 hover:text-[#ff8c30] transition-colors"
              >
                + Add emergency contact
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
