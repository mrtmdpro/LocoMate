"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

/**
 * Admin host-verification queue. Approving a host flips
 * verificationStatus → 'approved', which is the gate hostExperience.publish
 * requires — without this surface no host could ever publish inventory.
 */
export default function AdminHostVerificationPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const { data: rows, isLoading } = trpc.host.adminListPendingHosts.useQuery(
    undefined,
    { enabled: isAdmin, retry: false },
  );

  const { data: flagged } = trpc.host.adminListFlaggedHosts.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });

  const approve = trpc.host.adminVerifyHost.useMutation({
    onSuccess: () => {
      toast.success("Host verified");
      utils.host.adminListPendingHosts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reject = trpc.host.adminRejectHost.useMutation({
    onSuccess: () => {
      toast.success("Host rejected");
      utils.host.adminListPendingHosts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAdmin) {
    return (
      <div className="p-4 lg:p-8">
        <Card className="border-dashed shadow-none">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Admin access required.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      <div>
        <p className="text-eyebrow text-primary">Verification</p>
        <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">
          Host applications
        </h1>
        <p className="text-xs text-muted-foreground">
          Approve guides so they can publish bookable experiences, or send them
          back for revision.
        </p>
      </div>

      {/* FR-POST-04 — guides flagged by low ratings need a moderation look. */}
      {flagged && flagged.length > 0 && (
        <Card className="border border-red-200 bg-red-50/60 shadow-none">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold text-red-700">
              Flagged for review · rating below 3.5 ({flagged.length})
            </p>
            {flagged.map((h) => (
              <div
                key={h.hostId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-secondary">
                  {h.displayName ?? "Unnamed host"}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {h.email ?? "no email"}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-red-700">
                  ★ {Number(h.avgRating ?? 0).toFixed(2)} · {h.totalReviews} reviews
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
      ) : rows?.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No host applications awaiting review.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows?.map((host) => {
            // `languages` is a jsonb column (typed loosely); normalise to a
            // string list for rendering.
            const languages = Array.isArray(host.languages)
              ? (host.languages as string[])
              : [];
            return (
            <Card key={host.hostId} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-secondary">
                      {host.displayName ?? "Unnamed host"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {host.email ?? "no email"}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {host.verificationStatus ?? "pending"}
                  </Badge>
                </div>

                {host.bio ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {host.bio}
                  </p>
                ) : (
                  <p className="text-xs italic text-amber-700">
                    No bio yet — host hasn&apos;t completed setup.
                  </p>
                )}

                {(host.specialties?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {host.specialties?.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                {languages.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Languages: {languages.join(", ")}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-sage text-white"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ hostId: host.hostId })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate({ hostId: host.hostId })}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
