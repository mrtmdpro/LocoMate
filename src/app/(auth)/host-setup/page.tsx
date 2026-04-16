"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogoFull } from "@/components/logo";
import { Switch } from "@/components/ui/switch";

const LANGUAGES = ["Vietnamese", "English", "French", "Japanese", "Korean", "Chinese", "Spanish"];
const SPECIALTIES = ["Street Food", "History", "Photography", "Hidden Cafes", "Art", "Nightlife", "Nature", "Walking Tours"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function HostSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["Vietnamese", "English"]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [availability, setAvailability] = useState<boolean[]>([true, true, true, true, true, true, false]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    arr.includes(val) ? set(arr.filter((v) => v !== val)) : set([...arr, val]);

  async function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      router.push("/host");
    }, 1000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D9EDBF]/20 to-white p-4">
      <div className="max-w-md mx-auto pt-6">
        <LogoFull size="md" className="justify-center mb-6" />
        <div className="flex gap-1.5 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-[#3f6f60]" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* Step 1: Profile */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Become a Local Host</h2>
              <p className="text-sm text-muted-foreground mt-1">Share your love for Hanoi with travelers</p>
            </div>
            <div className="flex justify-center">
              <div className="w-28 h-28 rounded-full bg-[#3f6f60]/10 flex items-center justify-center border-2 border-dashed border-[#3f6f60]/30 cursor-pointer">
                <div className="text-center">
                  <svg className="w-8 h-8 text-[#3f6f60]/50 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                  <span className="text-xs text-[#3f6f60]/50 mt-1">Add photo</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Your bio</Label>
              <Textarea placeholder="Tell travelers what makes you a great host..." value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} className="rounded-xl resize-none h-24" />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/300</p>
            </div>
          </div>
        )}

        {/* Step 2: Expertise */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Your expertise</h2>
              <p className="text-sm text-muted-foreground mt-1">Help us connect you with the right travelers</p>
            </div>
            <div>
              <Label className="mb-3 block">Languages</Label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <Badge
                    key={lang}
                    variant={languages.includes(lang) ? "default" : "outline"}
                    className={`cursor-pointer px-3.5 py-2 text-xs rounded-full ${
                      languages.includes(lang) ? "bg-[#3f6f60] text-white border-[#3f6f60]" : ""
                    }`}
                    onClick={() => toggle(languages, lang, setLanguages)}
                  >
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-3 block">Specialties</Label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((spec) => (
                  <Badge
                    key={spec}
                    variant={specialties.includes(spec) ? "default" : "outline"}
                    className={`cursor-pointer px-3.5 py-2 text-xs rounded-full ${
                      specialties.includes(spec) ? "bg-[#ff8c30] text-white border-[#ff8c30]" : ""
                    }`}
                    onClick={() => toggle(specialties, spec, setSpecialties)}
                  >
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Availability */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Availability</h2>
              <p className="text-sm text-muted-foreground mt-1">When can you host?</p>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                {DAYS.map((day, i) => (
                  <div key={day} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{day}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">8:00 - 20:00</span>
                      <Switch checked={availability[i]} onCheckedChange={(checked) => {
                        const newAvail = [...availability];
                        newAvail[i] = checked;
                        setAvailability(newAvail);
                      }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Verification */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Identity verification</h2>
              <p className="text-sm text-muted-foreground mt-1">Required for traveler trust and safety</p>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#3f6f60]/30">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  <p className="text-sm font-medium text-gray-500">Upload ID document</p>
                  <p className="text-xs text-muted-foreground mt-1">CCCD or Passport (front side)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#3f6f60]/10 bg-[#3f6f60]/5">
              <CardContent className="p-4">
                <h3 className="font-semibold text-[#3f6f60] text-sm mb-2">Host Standards</h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>&#x2713; Be punctual and professional</li>
                  <li>&#x2713; Maintain traveler safety at all times</li>
                  <li>&#x2713; Quality reviewed after every tour</li>
                  <li>&#x2713; Continuous training and support</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Nav */}
        <div className="flex gap-3 mt-8">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-12 rounded-xl">Back</Button>}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="flex-1 h-12 rounded-xl bg-[#3f6f60] hover:bg-[#2d5a4d] text-white font-semibold">
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-12 rounded-xl bg-[#3f6f60] hover:bg-[#2d5a4d] text-white font-semibold">
              {submitting ? "Submitting..." : "Submit for Review"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
