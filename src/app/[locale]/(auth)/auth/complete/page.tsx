"use client";

import { Suspense, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth";
import { LogoLockup } from "@/components/brand";

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  isNew: boolean;
  returnTo: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    avatarUrl?: string | null;
    onboardingCompleted?: boolean;
  };
}

function isSafeReturnTo(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//")) return false;
  return true;
}

function AuthCompleteInner() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const t = useTranslations("auth.complete");
  // React Strict Mode double-invokes effects in dev; the /api/auth/session
  // endpoint is single-use (it clears the handoff cookies). Guard with a ref
  // so we only fire once.
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) {
          router.replace("/login?error=handoff");
          return;
        }
        const data = (await res.json()) as SessionResponse;

        setAuth(data.user, data.accessToken, data.refreshToken);

        const sessionReturnTo =
          typeof window !== "undefined"
            ? sessionStorage.getItem("locomate-return-to")
            : null;
        if (sessionReturnTo) {
          sessionStorage.removeItem("locomate-return-to");
        }

        // Hosts + admins skip traveler onboarding AND the traveler-shaped
        // /home feed. Their dashboard at /host is the right landing page.
        const isHostOrAdmin =
          data.user.role === "host" || data.user.role === "admin";
        let target = isHostOrAdmin ? "/host" : "/home";
        if (data.isNew && !isHostOrAdmin && !data.user.onboardingCompleted) {
          target = "/onboarding";
        } else if (isSafeReturnTo(sessionReturnTo)) {
          target = sessionReturnTo;
        } else if (isSafeReturnTo(data.returnTo)) {
          target = data.returnTo;
        }
        router.replace(target);
      } catch {
        router.replace("/login?error=handoff");
      }
    })();
    // `setAuth` and `router` are stable; effect must run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/30 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4"
      >
        <LogoLockup size="md" />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>{t("signingIn")}</span>
        </div>
      </motion.div>
    </div>
  );
}

function AuthCompleteFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/30 to-white flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <LogoLockup size="md" />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Preparing…</span>
        </div>
      </div>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<AuthCompleteFallback />}>
      <AuthCompleteInner />
    </Suspense>
  );
}
