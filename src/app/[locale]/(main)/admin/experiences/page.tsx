"use client";

import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export default function AdminExperienceModerationPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const { data: rows, isLoading } = trpc.hostExperience.adminListModeration.useQuery(
    undefined,
    { enabled: isAdmin, retry: false },
  );

  const approve = trpc.hostExperience.adminApprove.useMutation({
    onSuccess: () => {
      toast.success("Experience approved");
      utils.hostExperience.adminListModeration.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reject = trpc.hostExperience.adminReject.useMutation({
    onSuccess: () => {
      toast.success("Experience rejected");
      utils.hostExperience.adminListModeration.invalidate();
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
        <p className="text-eyebrow text-primary">Moderation</p>
        <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">
          Host experiences
        </h1>
        <p className="text-xs text-muted-foreground">
          Approve listings or send them back to hosts with review notes.
        </p>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
      ) : rows?.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No host listings yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows?.map(({ authorEmail, authorName, experience }) => (
            <Card key={experience.id} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[160px_1fr]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  {experience.photos?.[0] && (
                    <Image
                      src={experience.photos[0]}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-secondary">
                        {experience.title}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {authorName ?? "Unknown host"} · {authorEmail ?? "no email"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {experience.status}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {experience.description}
                  </p>
                  {experience.reviewNotes && (
                    <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                      Previous note: {experience.reviewNotes}
                    </p>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="Review note for rejection"
                    value={notesById[experience.id] ?? ""}
                    onChange={(event) =>
                      setNotesById((current) => ({
                        ...current,
                        [experience.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-sage text-white"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate({ id: experience.id })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      disabled={reject.isPending}
                      onClick={() =>
                        reject.mutate({
                          id: experience.id,
                          reviewNotes:
                            notesById[experience.id]?.trim() ||
                            "Please revise this listing before publishing.",
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
