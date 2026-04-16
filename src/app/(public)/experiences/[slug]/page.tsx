"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";

export default function ExperienceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: exp, isLoading } = trpc.experience.getBySlug.useQuery({ slug });

  if (isLoading) return <div className="p-4 space-y-4"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  if (!exp) return <div className="p-4 text-center">Experience not found</div>;

  const highlights = (exp.highlights || []) as string[];
  const included = (exp.included || []) as string[];
  const schedule = (exp.schedule || []) as { time: string; label: string }[];
  const photos = (exp.photos || []) as string[];

  const handleBook = () => {
    if (!user) { router.push("/register"); return; }
    toast.info("Bookings opening soon! We'll notify you when this experience is available.");
  };

  return (
    <div className="pb-24">
      <div className="h-72 relative overflow-hidden">
        {photos[0] && <img src={photos[0]} alt={exp.title} className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button onClick={() => router.back()} className="absolute top-4 left-4 bg-white/90 rounded-full p-2 shadow-md z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Badge className="bg-[#ff8c30] border-0 text-white text-[10px] capitalize mb-2">{exp.category}</Badge>
          <h1 className="text-2xl font-bold font-heading text-white">&ldquo;{exp.title}&rdquo;</h1>
          <p className="text-sm text-white/80 mt-1">{exp.subtitle}</p>
        </div>
      </div>

      <div className="p-4 -mt-4 relative space-y-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-[#3f6f60]">{exp.durationMinutes >= 60 ? `${Math.floor(exp.durationMinutes / 60)}h${exp.durationMinutes % 60 ? ` ${exp.durationMinutes % 60}m` : ""}` : `${exp.durationMinutes}m`}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#ff8c30]">{(exp.priceAmount / 1000).toFixed(0)}k</p>
                <p className="text-[10px] text-muted-foreground uppercase">VND / person</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-yellow-500 text-sm">★</span>
                  <p className="text-lg font-bold text-[#3f6f60]">{Number(exp.avgRating || 0).toFixed(1)}</p>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase">{exp.totalBookings ?? 0} booked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-[#3f6f60] mb-2">About this experience</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{exp.description}</p>
          </CardContent>
        </Card>

        {highlights.length > 0 && (
          <Card className="border-0 bg-[#D9EDBF]/30">
            <CardContent className="p-4">
              <h3 className="font-bold text-[#3f6f60] mb-3">Highlights</h3>
              <div className="space-y-2">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[#90D26D] mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <p className="text-sm text-[#3f6f60]">{h}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {schedule.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-[#3f6f60] mb-3">Schedule</h3>
              <div className="space-y-3">
                {schedule.map((s, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-[#ff8c30]" : "bg-[#D9EDBF]"}`} />
                      {i < schedule.length - 1 && <div className="w-0.5 h-6 bg-gray-200" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#ff8c30]">{s.time}</p>
                      <p className="text-sm text-[#3f6f60]">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {included.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-[#3f6f60] mb-3">What&apos;s Included</h3>
              <div className="grid grid-cols-2 gap-2">
                {included.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#ff8c30] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <p className="text-xs text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full h-14 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg"
          onClick={handleBook}
        >
          {user ? `Book Now — ${(exp.priceAmount / 1000).toFixed(0)}k VND` : "Sign up to book this experience"}
        </Button>

        {!user && (
          <Card className="border-[#ff8c30]/20 bg-[#ff8c30]/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm font-semibold text-[#3f6f60]">Create a free account to build your personalized Hanoi itinerary</p>
              <Link href="/register">
                <Button className="mt-2 bg-[#3f6f60] hover:bg-[#2d5a4d] text-white font-bold rounded-xl px-6 text-sm">
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {exp.hostRequired && (
          <p className="text-center text-[10px] text-muted-foreground">
            This experience requires a local host. You&apos;ll be connected with your host via chat after booking.
          </p>
        )}
      </div>
    </div>
  );
}
