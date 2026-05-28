"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { formatDateLong } from "@/lib/format";

/**
 * Trust & safety review queue. Lists open reports alongside the
 * offending message for quick triage. Admin-gated via
 * `adminProcedure`; non-admins get redirected away.
 *
 * MVP actions:
 *   - Resolve  (marks the report handled; leaves the message flagged)
 *   - Dismiss  (marks the report as a false positive)
 * Ban / soft-ban of the sender is a future extension -- the current
 * rate-limit + block mechanics absorb most of the pain anyway.
 */
export default function AdminFlaggedPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data: rows, isLoading } = trpc.chat.adminListFlagged.useQuery(
    { limit: 50 },
    { enabled: isAdmin, retry: false },
  );

  const resolve = trpc.chat.adminResolveReport.useMutation({
    onSuccess: () => {
      utils.chat.adminListFlagged.invalidate();
      setResolvingId(null);
    },
    onError: (err) => toast.error(err.message ?? "Resolve failed"),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center space-y-3 pb-24">
        <div className="text-4xl">🔒</div>
        <p className="text-base font-semibold text-secondary">Admin access required</p>
        <p className="text-sm text-muted-foreground">
          The trust &amp; safety queue is reserved for platform admins.
        </p>
        <Link href="/home" className="text-primary text-sm font-semibold">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">Flagged messages</h1>
          <p className="text-sm text-muted-foreground">
            User reports + automated moderation hits. Resolve or dismiss each item.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : !rows || rows.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
            <CardContent className="p-8 text-center space-y-2">
              <div className="text-4xl">🌿</div>
              <p className="text-base font-semibold text-secondary">Nothing to review</p>
              <p className="text-sm text-muted-foreground">No open reports right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const busy = resolvingId === row.report.id && resolve.isPending;
              return (
                <Card key={row.report.id} className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-100 text-amber-800 border-0 text-xs capitalize">
                          {row.report.reason}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Reported {row.report.createdAt ? formatDateLong(row.report.createdAt as unknown as string) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => {
                            setResolvingId(row.report.id);
                            resolve.mutate({ reportId: row.report.id, resolution: "dismissed" });
                          }}
                          disabled={busy}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-secondary hover:bg-secondary/90"
                          onClick={() => {
                            setResolvingId(row.report.id);
                            resolve.mutate({ reportId: row.report.id, resolution: "resolved" });
                          }}
                          disabled={busy}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 border border-border p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {row.sender?.displayName ?? "[unknown sender]"}
                        {row.sender?.email ? ` · ${row.sender.email}` : ""}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {row.message.content}
                      </p>
                      {row.message.attachmentUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.message.attachmentUrl}
                          alt="Reported attachment"
                          className="mt-2 max-h-48 rounded-md object-cover"
                        />
                      )}
                    </div>
                    {row.report.notes && (
                      <p className="text-xs text-muted-foreground">
                        Reporter note: {row.report.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
