"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { LogoLockup } from "@/components/brand";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const t = useTranslations("landing");

  useEffect(() => {
    if (user) router.replace("/home");
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1616486410185-81af2d32a2af?w=1200&h=900&fit=crop)",
        }}
      />

      <header className="fixed top-0 w-full z-50 bg-card/80 backdrop-blur-md flex justify-between items-center px-6 py-4">
        <LogoLockup size="sm" />
        {user && (
          <div className="w-10 h-10 rounded-full bg-mustard/25 flex items-center justify-center overflow-hidden border-2 border-white">
            {user.avatarUrl && <Image src={user.avatarUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />}
          </div>
        )}
      </header>

      <main className="flex-grow pt-24 pb-32 px-6 flex flex-col justify-end relative z-10">
        <div className="w-full max-w-md mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-foreground/5 border border-foreground/10"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-mustard/25 text-secondary text-xs font-bold uppercase tracking-widest mb-4">
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 4.346a1 1 0 01-.025.846A3.955 3.955 0 0115 14.5a3.955 3.955 0 01-2.927-1.297 1 1 0 01-.025-.846l1.738-4.346L10 6.395 6.214 8.011l1.738 4.346a1 1 0 01-.025.846A3.955 3.955 0 015 14.5a3.955 3.955 0 01-2.927-1.297 1 1 0 01-.025-.846l1.738-4.346-1.233-.617a1 1 0 11.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z" />
              </svg>
              {t("eyebrow")}
            </div>

            <h2 className="text-4xl font-extrabold tracking-tight text-secondary leading-[1.1] mb-4 font-[Sora,sans-serif]">
              {t("headlinePart1")}{" "}
              <span className="text-primary">{t("headlinePart2")}</span>{" "}
              {t("headlinePart3")}
            </h2>

            <p className="text-foreground/80 leading-relaxed text-lg font-medium">
              {t("body")}
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-card rounded-xl text-sm font-semibold shadow-sm border border-emerald-50">
                <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                {t("features.fixedTours")}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-card rounded-xl text-sm font-semibold shadow-sm border border-emerald-50">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t("features.activitiesTickets")}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-card rounded-xl text-sm font-semibold shadow-sm border border-emerald-50">
                <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {t("features.hanoiMerch")}
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
              {t("actions.getStarted")}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
            <Button
              onClick={() => router.push("/login")}
              variant="outline"
              className="w-full py-6 rounded-2xl bg-card/90 hover:bg-card text-foreground font-bold text-lg border border-foreground/10"
            >
              {t("actions.haveAccount")}
            </Button>
          </motion.div>
        </div>

        <div className="absolute top-10 right-[-20px] rotate-6 opacity-40 pointer-events-none">
          <div className="bg-card p-2 rounded-xl shadow-xl w-32 h-32 border-4 border-white overflow-hidden relative">
            <Image
              src="https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=300"
              alt="Map view"
              fill
              sizes="128px"
              className="object-cover rounded-lg"
            />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-card/90 backdrop-blur-lg rounded-t-[32px] border-t border-emerald-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => router.push("/explore")} className="flex flex-col items-center text-secondary bg-mustard/25 rounded-2xl px-5 py-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest mt-1">{t("nav.explore")}</span>
        </button>
        <button onClick={() => router.push("/experiences")} className="flex flex-col items-center text-muted-foreground px-5 py-2 hover:text-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest mt-1">{t("nav.tours")}</span>
        </button>
        <button onClick={() => router.push("/activities")} className="flex flex-col items-center text-muted-foreground px-5 py-2 hover:text-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest mt-1">{t("nav.activities")}</span>
        </button>
        <button onClick={() => router.push(user ? "/profile" : "/login")} className="flex flex-col items-center text-muted-foreground px-5 py-2 hover:text-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest mt-1">{t("nav.profile")}</span>
        </button>
      </nav>
    </div>
  );
}
