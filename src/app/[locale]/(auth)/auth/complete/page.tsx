"use client";

import { Suspense, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { LogoLockup } from "@/components/brand";

/**
 * Legacy OAuth landing page. Post-Cluster-C the Google callback sets the
 * httpOnly auth cookies and redirects straight to the destination, so this
 * page is only reachable from stale links/bookmarks. It now just bounces to
 * /home — the global AuthBootstrap (in Providers) hydrates the user store from
 * the session cookie via `auth.me`.
 */
function AuthCompleteInner() {
  const router = useRouter();
  const t = useTranslations("auth.complete");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    router.replace("/home");
  }, [router]);

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

export default function AuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <AuthCompleteInner />
    </Suspense>
  );
}
