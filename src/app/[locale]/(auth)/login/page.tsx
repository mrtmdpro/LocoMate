"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { LogoWithText } from "@/components/brand";
import type { LoginInput } from "@/lib/validations/auth";

/**
 * The OAuth callback bounces failures back here as `?error=<code>`. We
 * keep the mapping centralised so the translation file holds a one-to-one
 * key per code; the renderer just calls `t(`oauthError.${code}`)`.
 */
const OAUTH_ERROR_CODES = [
  "email_exists",
  "access_denied",
  "state",
  "token",
  "exchange",
  "server",
  "not_configured",
  "unverified_google",
  "inactive",
  "handoff",
] as const;
type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];
function isOAuthErrorCode(code: string | null): code is OAuthErrorCode {
  return code !== null && (OAUTH_ERROR_CODES as readonly string[]).includes(code);
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const t = useTranslations("auth.login");

  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<LoginInput>();

  const returnTo = searchParams.get("returnTo");
  const errorCode = searchParams.get("error");
  const [prefillEmail, setPrefillEmail] = useState("");
  const oauthError = (() => {
    if (!isOAuthErrorCode(errorCode)) return null;
    if (errorCode === "email_exists") {
      return prefillEmail
        ? t("oauthError.email_exists_with_email", { email: prefillEmail })
        : t("oauthError.email_exists");
    }
    return t(`oauthError.${errorCode}`);
  })();

  useEffect(() => {
    // When the OAuth callback bounced us here with ?error=email_exists, it
    // also set a short-lived httpOnly `oauth_prefill_email` cookie. Swap that
    // cookie for the email so we can prefill the form without ever putting
    // PII in the URL (which would leak to Referer / access logs / history).
    if (errorCode !== "email_exists") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/prefill", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { email: string | null };
        if (data.email) {
          setPrefillEmail(data.email);
          setValue("email", data.email);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [errorCode]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setLoggingIn(true);
      setAuth(data.user);
      setTimeout(() => {
        // Hosts + admins never go through traveler onboarding, even if their
        // user_profiles row is missing or has onboardingCompleted=false.
        // Their onboarding is /host-setup + ID verification.
        const isHostOrAdmin =
          data.user.role === "host" || data.user.role === "admin";
        if (!isHostOrAdmin && !data.user.onboardingCompleted) {
          router.push("/onboarding");
        } else if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
          router.push(returnTo);
        } else {
          // Hosts land on their dashboard; travelers on the traveler feed.
          // The `/home` page itself is traveler-shaped (plan a tour, hidden
          // gems, host-for-hire promo), so even if a host ends up there via
          // a stale link the page redirects them back to /host.
          router.push(isHostOrAdmin ? "/host" : "/home");
        }
      }, 600);
    },
    onError: (err) => setError(err.message),
  });

  function startGoogleOAuth() {
    const safeReturn = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/home";
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(safeReturn)}`;
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/30 to-white flex items-center justify-center p-4 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={loggingIn ? { opacity: 0, y: -20, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: loggingIn ? 0.5 : 0.4, ease: "easeInOut" }}
    >
      <Image src="https://images.unsplash.com/photo-1616486410185-81af2d32a2af?w=1200&h=800&fit=crop" alt="" fill sizes="100vw" className="object-cover opacity-10 z-0" />
      <Card className="w-full max-w-md border-0 shadow-xl relative z-10 overflow-hidden">
        <div className="h-36 relative overflow-hidden">
          <Image src="https://images.unsplash.com/photo-1616486410185-81af2d32a2af?w=800&h=300&fit=crop" alt="" fill sizes="(max-width: 768px) 100vw, 448px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-white font-bold text-lg font-heading">{t("welcomeBack")}</h2>
            <p className="text-white/70 text-xs">{t("continueAdventure")}</p>
          </div>
        </div>
        <CardHeader className="text-center pb-2 pt-4">
          <div className="flex justify-center mb-1">
            <LogoWithText className="h-32 w-auto" />
          </div>
        </CardHeader>
        <CardContent>
          {oauthError && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded-lg">
              {oauthError}
            </div>
          )}
          <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                {...register("email", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <Input id="password" type="password" placeholder={t("passwordPlaceholder")} {...register("password", { required: true })} />
            </div>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/85 text-primary-foreground font-semibold h-12 rounded-xl" disabled={isSubmitting || loggingIn}>
                {loggingIn ? t("welcome") : isSubmitting ? t("signingIn") : t("signIn")}
              </Button>
            </motion.div>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">{t("orContinue")}</span></div>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-medium"
              onClick={startGoogleOAuth}
              disabled={loggingIn}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t("continueWithGoogle")}
            </Button>
          </div>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {t.rich("noAccount", {
              link: (chunks) => (
                <Link href="/register" className="text-primary font-medium hover:underline">{chunks}</Link>
              ),
            })}
          </div>
          <div className="mt-4 px-4 py-3 bg-secondary/5 rounded-lg text-center">
            <p className="text-xs text-secondary">{t("trustLine")}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/30 to-white flex items-center justify-center p-4">
          <LogoWithText className="h-36 w-auto" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
