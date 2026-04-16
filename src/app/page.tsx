"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) router.replace("/home");
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0fdf4] relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&h=900&fit=crop)",
        }}
      />

      <header className="fixed top-0 w-full z-50 bg-emerald-50/80 backdrop-blur-md flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <h1 className="text-2xl font-black italic text-orange-600 tracking-tighter font-[Sora,sans-serif]">
            LOCOMATE
          </h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border-2 border-white">
          <img
            src="https://randomuser.me/api/portraits/men/32.jpg"
            alt="User"
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      <main className="flex-grow pt-24 pb-32 px-6 flex flex-col justify-end relative z-10">
        <div className="w-full max-w-md mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-teal-900/5 border border-white/50"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-teal-900 text-[10px] font-bold uppercase tracking-widest mb-4">
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 4.346a1 1 0 01-.025.846A3.955 3.955 0 0115 14.5a3.955 3.955 0 01-2.927-1.297 1 1 0 01-.025-.846l1.738-4.346L10 6.395 6.214 8.011l1.738 4.346a1 1 0 01-.025.846A3.955 3.955 0 015 14.5a3.955 3.955 0 01-2.927-1.297 1 1 0 01-.025-.846l1.738-4.346-1.233-.617a1 1 0 11.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z" />
              </svg>
              AI-Powered Discovery
            </div>

            <h2 className="text-4xl font-extrabold tracking-tight text-teal-900 leading-[1.1] mb-4 font-[Sora,sans-serif]">
              Your local lens for{" "}
              <span className="text-orange-500">Hanoi</span>
            </h2>

            <p className="text-teal-900/80 leading-relaxed text-lg font-medium">
              Experience authentic solo travel through AI-personalized
              itineraries and verified local host connections.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl text-sm font-semibold shadow-sm border border-emerald-50">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Hidden Gems
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl text-sm font-semibold shadow-sm border border-emerald-50">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                Premium Experiences
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col gap-3"
          >
            <Button
              onClick={() => router.push("/register")}
              className="w-full py-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg shadow-lg shadow-orange-500/20 flex justify-center items-center gap-2"
            >
              Get started
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
            <Button
              onClick={() => router.push("/login")}
              variant="outline"
              className="w-full py-6 rounded-2xl bg-white/90 hover:bg-white text-teal-900 font-bold text-lg border border-teal-900/10"
            >
              I have an account
            </Button>
          </motion.div>
        </div>

        <div className="absolute top-10 right-[-20px] rotate-6 opacity-40 pointer-events-none">
          <div className="bg-white p-2 rounded-xl shadow-xl w-32 h-32 border-4 border-white overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=300&h=300&fit=crop"
              alt="Map view"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-white/90 backdrop-blur-lg rounded-t-[32px] border-t border-emerald-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button className="flex flex-col items-center text-teal-900 bg-emerald-100 rounded-2xl px-5 py-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-widest mt-1">Explore</span>
        </button>
        <button onClick={() => router.push("/plan")} className="flex flex-col items-center text-slate-400 px-5 py-2 hover:text-orange-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-widest mt-1">Itinerary</span>
        </button>
        <button onClick={() => router.push("/experiences")} className="flex flex-col items-center text-slate-400 px-5 py-2 hover:text-orange-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-widest mt-1">Experiences</span>
        </button>
        <button onClick={() => router.push("/profile")} className="flex flex-col items-center text-slate-400 px-5 py-2 hover:text-orange-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-widest mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
