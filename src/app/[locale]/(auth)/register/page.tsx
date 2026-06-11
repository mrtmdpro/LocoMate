"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { LogoLockup } from "@/components/brand";
import type { RegisterInput } from "@/lib/validations/auth";

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [role, setRole] = useState<"traveler" | "host">("traveler");
  const t = useTranslations("auth.register");

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<RegisterInput>();

  const returnTo = searchParams.get("returnTo");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setAuth(data.user);
      router.push("/onboarding");
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
    <div className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/30 to-white flex items-center justify-center p-4 relative overflow-hidden">
      <Image src="https://images.unsplash.com/photo-1616486410185-81af2d32a2af?w=1200&h=800&fit=crop" alt="" fill sizes="100vw" className="object-cover opacity-10 z-0" />
      <Card className="w-full max-w-md border-0 shadow-xl relative z-10 overflow-hidden">
        <div className="h-36 relative overflow-hidden">
          <Image src="https://images.unsplash.com/photo-1616486410185-81af2d32a2af?w=800&h=300&fit=crop" alt="" fill sizes="(max-width: 768px) 100vw, 448px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-white font-bold text-lg font-heading">{t("hero")}</h2>
            <p className="text-white/70 text-xs">{t("subhero")}</p>
          </div>
        </div>
        <CardHeader className="text-center pb-2 pt-4">
          <div className="flex justify-center mb-1">
            <LogoLockup size="md" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            {(["traveler", "host"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  role === r
                    ? "bg-primary text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {r === "traveler" ? t("roles.traveler") : t("roles.host")}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit((data) => registerMutation.mutate({ ...data, role }))} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("displayNameLabel")}</Label>
              <Input id="displayName" placeholder={t("displayNamePlaceholder")} {...register("displayName", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input id="email" type="email" placeholder={t("emailPlaceholder")} {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <Input id="password" type="password" placeholder={t("passwordPlaceholder")} {...register("password", { required: true, minLength: 8 })} />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/85 text-primary-foreground font-semibold h-12 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? t("creating") : t("createAccount")}
            </Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">{t("orSignUp")}</span></div>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-medium"
              onClick={startGoogleOAuth}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t("signUpWithGoogle")}
            </Button>
          </div>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {t.rich("haveAccount", {
              link: (chunks) => (
                <Link href="/login" className="text-primary font-medium hover:underline">{chunks}</Link>
              ),
            })}
          </div>
          <div className="mt-4 px-4 py-3 bg-secondary/5 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <p className="text-xs text-secondary">{t("trustLine")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/30 to-white flex items-center justify-center p-4">
          <LogoLockup size="md" />
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
