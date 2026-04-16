"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { LogoFull } from "@/components/logo";
import type { LoginInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginInput>();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setLoggingIn(true);
      setAuth(data.user, data.accessToken, data.refreshToken);
      setTimeout(() => {
        if (!data.user.onboardingCompleted) {
          router.push("/onboarding");
        } else {
          router.push("/home");
        }
      }, 600);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-[#D9EDBF]/30 to-white flex items-center justify-center p-4 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={loggingIn ? { opacity: 0, y: -20, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: loggingIn ? 0.5 : 0.4, ease: "easeInOut" }}
    >
      <img src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&h=800&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 z-0" />
      <Card className="w-full max-w-md border-0 shadow-xl relative z-10 overflow-hidden">
        <div className="h-36 relative overflow-hidden">
          <img src="https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=800&h=300&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-white font-bold text-lg font-heading">Welcome back.</h2>
            <p className="text-white/70 text-xs">Continue your Hanoi adventure</p>
          </div>
        </div>
        <CardHeader className="text-center pb-2 pt-4">
          <LogoFull size="md" className="justify-center mb-1" />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Your password" {...register("password", { required: true })} />
            </div>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button type="submit" className="w-full bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold h-12 rounded-xl" disabled={isSubmitting || loggingIn}>
                {loggingIn ? "Welcome!" : isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </motion.div>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-muted-foreground">or continue with</span></div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl font-medium"
              onClick={() => {
                toast.info("Demo mode: signing in as Alex Johnson...");
                loginMutation.mutate({ email: "alex@test.com", password: "password123" });
              }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl font-medium"
              onClick={() => {
                loginMutation.mutate({ email: "alex@test.com", password: "password123" });
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Continue with Apple
            </Button>
          </div>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#ff8c30] font-medium hover:underline">Create one</Link>
          </div>
          <div className="mt-4 px-4 py-3 bg-[#3f6f60]/5 rounded-lg text-center">
            <p className="text-xs text-[#3f6f60]">Trusted by 5,000+ solo travelers. Your safety is our priority.</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
