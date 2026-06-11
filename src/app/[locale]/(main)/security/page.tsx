"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function SecurityPage() {
  const t = useTranslations("security");
  const { user, logout } = useAuthStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const profileQuery = trpc.user.getProfile.useQuery(undefined, {
    enabled: !!user,
  });
  const profileUser = profileQuery.data?.user;
  const hasPassword = profileUser?.hasPassword ?? true;
  const emailVerified = profileUser?.emailVerified ?? false;
  const linkedProviders = profileUser?.linkedProviders ?? [];
  const googleLinked = linkedProviders.includes("google");
  const host = profileQuery.data?.host ?? null;
  const isHost = profileUser?.role === "host";

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success(t("toast.accountDeleted"));
      // Clear all client auth state and related caches before navigating
      // so the next render does not hit a 401 loop against the ghost user.
      logout();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("locomate-return-to");
      }
      // Full page nav (not router.push) guarantees providers remount and
      // all TanStack Query caches are dropped.
      window.location.href = "/";
    },
    onError: (err) => {
      setDeleteError(err.message);
    },
  });

  const userEmail = (user?.email ?? "").toLowerCase();
  const emailMatches =
    userEmail.length > 0 && confirmEmail.trim().toLowerCase() === userEmail;
  const passwordProvided = !hasPassword || currentPassword.length > 0;
  const canConfirmDelete =
    emailMatches && passwordProvided && !deleteAccount.isPending;

  function handleCloseDelete(open: boolean) {
    setDeleteOpen(open);
    if (!open) {
      setConfirmEmail("");
      setCurrentPassword("");
      setDeleteError("");
    }
  }

  function handleConfirmDelete() {
    setDeleteError("");
    deleteAccount.mutate({
      confirmEmail: confirmEmail.trim(),
      currentPassword: hasPassword ? currentPassword : undefined,
    });
  }

  return (
    <div className="pb-24 lg:pb-8 min-h-screen bg-card lg:max-w-3xl lg:mx-auto lg:px-8 lg:py-6">
      <PageHeader title={t("heading")} />

      <div className="px-4 space-y-5">
        {/* Password */}
        <div>
          <p className="text-xs text-secondary uppercase tracking-widest font-semibold mb-2 px-1">{t("sections.password")}</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm lg:text-base font-medium">{t("password.label")}</p>
                  <p className="text-sm text-muted-foreground">{t("password.lastChangedNever")}</p>
                </div>
                <Button size="sm" className="h-10 text-sm bg-primary hover:bg-primary/85 text-primary-foreground rounded-lg" onClick={() => toast.info(t("password.toastComingSoon"))}>
                  {t("password.changeBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two-Factor Authentication */}
        <div>
          <p className="text-xs text-secondary uppercase tracking-widest font-semibold mb-2 px-1">{t("sections.twoFA")}</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-sm lg:text-base font-medium">{t("twoFA.label")}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t("twoFA.subtitle")}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-muted-foreground">{t("twoFA.comingSoon")}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification */}
        <div>
          <p className="text-xs text-secondary uppercase tracking-widest font-semibold mb-2 px-1">{t("sections.verification")}</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {/* Email */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base font-medium">{t("verification.email")}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email ?? t("verification.emailFallback")}</p>
                  </div>
                </div>
                {emailVerified ? (
                  <Badge className="bg-sage/20 text-foreground border-0 text-xs">{t("verification.verified")}</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">{t("verification.unverified")}</Badge>
                )}
              </div>

              <Separator />

              {/* Password sign-in */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base font-medium">{t("verification.passwordLabel")}</p>
                    <p className="text-sm text-muted-foreground">
                      {hasPassword ? t("verification.passwordSet") : t("verification.passwordNotSet")}
                    </p>
                  </div>
                </div>
                {hasPassword ? (
                  <Badge className="bg-sage/20 text-foreground border-0 text-xs">{t("verification.enabled")}</Badge>
                ) : (
                  <Badge className="bg-muted/80 text-muted-foreground border-0 text-xs">{t("verification.off")}</Badge>
                )}
              </div>

              <Separator />

              {/* Google sign-in */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base font-medium">{t("verification.googleLabel")}</p>
                    <p className="text-sm text-muted-foreground">
                      {googleLinked ? t("verification.googleLinked") : t("verification.googleNotLinked")}
                    </p>
                  </div>
                </div>
                {googleLinked ? (
                  <Badge className="bg-sage/20 text-foreground border-0 text-xs">{t("verification.googleBadgeLinked")}</Badge>
                ) : (
                  <Badge className="bg-muted/80 text-muted-foreground border-0 text-xs">{t("verification.off")}</Badge>
                )}
              </div>

              {/* Host identity (hosts only) */}
              {isHost && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm lg:text-base font-medium">{t("verification.hostIdentity")}</p>
                        <p className="text-sm text-muted-foreground">
                          {host?.verificationStatus === "approved"
                            ? t("verification.hostApproved")
                            : host?.verificationStatus === "rejected"
                            ? t("verification.hostRejected")
                            : t("verification.hostPending")}
                        </p>
                      </div>
                    </div>
                    {host?.verificationStatus === "approved" ? (
                      <Badge className="bg-sage/20 text-foreground border-0 text-xs">{t("verification.hostBadgeVerified")}</Badge>
                    ) : host?.verificationStatus === "rejected" ? (
                      <Badge className="bg-red-100 text-red-700 border-0 text-xs">{t("verification.hostBadgeRejected")}</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">{t("verification.hostBadgePending")}</Badge>
                    )}
                  </div>
                  <Separator />
                  <Link href="/host" className="block p-4 text-sm font-semibold text-secondary hover:text-primary transition-colors">
                    {t("verification.hostDashboard")}
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Danger Zone */}
        <div id="danger-zone" className="scroll-mt-20">
          <p className="text-xs text-red-600 uppercase tracking-widest font-semibold mb-2 px-1">{t("sections.dangerZone")}</p>
          <Card className="border border-red-200 bg-red-50/40 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm lg:text-base font-semibold text-red-700">{t("dangerZone.deleteTitle")}</p>
                  <p className="text-sm text-red-800 mt-1 leading-relaxed">
                    {t("dangerZone.deleteBody")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 text-sm rounded-lg border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 shrink-0"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t("dangerZone.deleteBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={handleCloseDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700">{t("deleteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("deleteDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              {t("deleteDialog.reviewsNotice")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmEmail" className="text-sm">
                {t("deleteDialog.confirmEmailLabel")}
              </Label>
              <Input
                id="confirmEmail"
                type="email"
                autoComplete="off"
                placeholder={user?.email ?? t("deleteDialog.confirmEmailPlaceholder")}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                disabled={deleteAccount.isPending}
              />
            </div>

            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm">
                  {t("deleteDialog.passwordLabel")}
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={deleteAccount.isPending}
                />
              </div>
            )}

            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                {deleteError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleCloseDelete(false)}
              disabled={deleteAccount.isPending}
            >
              {t("deleteDialog.keepCta")}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              disabled={!canConfirmDelete}
              onClick={handleConfirmDelete}
            >
              {deleteAccount.isPending ? t("deleteDialog.deletingCta") : t("deleteDialog.deleteCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
