"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import type { RegisterInput } from "@/lib/validations/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [role, setRole] = useState<"traveler" | "host">("traveler");

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<RegisterInput>();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push("/onboarding");
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D9EDBF]/30 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <img src="/images/logo.png" alt="LOCOMATE" className="h-14 mx-auto mb-1" />
          <CardTitle className="text-xl text-[#3f6f60]">Create your account</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Start your personalized Hanoi journey</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            {(["traveler", "host"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  role === r
                    ? "bg-[#ff8c30] text-white shadow-md"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {r === "traveler" ? "Traveler" : "Local Host"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit((data) => registerMutation.mutate({ ...data, role }))} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" placeholder="Your name" {...register("displayName", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min 8 characters" {...register("password", { required: true, minLength: 8 })} />
            </div>
            <Button type="submit" className="w-full bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold h-12 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-[#ff8c30] font-medium hover:underline">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
