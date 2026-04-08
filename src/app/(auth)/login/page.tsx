"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import type { LoginInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginInput>();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      if (!data.user.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push("/explore");
      }
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D9EDBF]/30 to-white flex items-center justify-center p-4 relative overflow-hidden">
      <img src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&h=800&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <Image src="/images/logo.png" alt="LOCOMATE" width={56} height={56} className="mx-auto mb-1" priority />
          <CardTitle className="text-xl text-[#3f6f60]">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue your Hanoi adventure</p>
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
            <Button type="submit" className="w-full bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold h-12 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#ff8c30] font-medium hover:underline">Create one</Link>
          </div>
          <div className="mt-4 px-4 py-3 bg-[#3f6f60]/5 rounded-lg text-center">
            <p className="text-xs text-[#3f6f60]">Trusted by 5,000+ solo travelers. Your safety is our priority.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
