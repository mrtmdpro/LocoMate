"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

type ActivityRow = NonNullable<ReturnType<typeof useActivityRows>>[number];

type ActivityForm = {
  category: string;
  description: string;
  durationMinutes: number;
  guideAddonVnd: number;
  guideOptional: boolean;
  highlightsText: string;
  includedText: string;
  maxCapacityPerSlot: number;
  photosText: string;
  priceAmount: number;
  requirementsText: string;
  subtitle: string;
  title: string;
};

const emptyForm: ActivityForm = {
  category: "workshop",
  description: "",
  durationMinutes: 90,
  guideAddonVnd: 200_000,
  guideOptional: true,
  highlightsText: "",
  includedText: "",
  maxCapacityPerSlot: 8,
  photosText: "",
  priceAmount: 250_000,
  requirementsText: "",
  subtitle: "",
  title: "",
};

export default function HostActivitiesPage() {
  const { user } = useAuthStore();
  const isHost = !!user && (user.role === "host" || user.role === "admin");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.activity.listMine.useQuery(undefined, {
    enabled: isHost,
  });
  const rows = useActivityRows(data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);

  const createActivity = trpc.activity.create.useMutation({
    onSuccess: () => {
      toast.success("Activity draft created");
      setForm(emptyForm);
      utils.activity.listMine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateActivity = trpc.activity.update.useMutation({
    onSuccess: () => {
      toast.success("Activity updated");
      setEditingId(null);
      setForm(emptyForm);
      utils.activity.listMine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const publishActivity = trpc.activity.publish.useMutation({
    onSuccess: () => {
      toast.success("Activity published");
      utils.activity.listMine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveActivity = trpc.activity.archive.useMutation({
    onSuccess: () => {
      toast.success("Activity archived");
      utils.activity.listMine.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const grouped = useMemo(() => ({
    archived: rows.filter((row) => row.status === "archived"),
    draft: rows.filter((row) => row.status === "draft" || row.status === "rejected"),
    published: rows.filter((row) => row.status === "published"),
  }), [rows]);

  if (!isHost) {
    return (
      <div className="p-4 lg:p-8">
        <Card className="border-dashed shadow-none">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            You need to be signed in as a host to manage activities.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSaving = createActivity.isPending || updateActivity.isPending;

  return (
    <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow text-primary">Host catalog</p>
          <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">
            Activities
          </h1>
          <p className="text-xs text-muted-foreground">
            Create tickets, workshops, classes, and add-ons without touching seed files.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
          }}
        >
          New draft
        </Button>
      </div>

      <ActivityFormCard
        editing={!!editingId}
        form={form}
        isSaving={isSaving}
        onCancel={() => {
          setEditingId(null);
          setForm(emptyForm);
        }}
        onChange={setForm}
        onSubmit={() => {
          const payload = formToPayload(form);
          if (editingId) {
            updateActivity.mutate({ id: editingId, patch: payload });
          } else {
            createActivity.mutate(payload);
          }
        }}
      />

      {isLoading ? (
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(["published", "draft", "archived"] as const).map((group) => (
            <section key={group} className="space-y-3">
              <h2 className="text-sm font-semibold capitalize text-secondary">
                {group} ({grouped[group].length})
              </h2>
              {grouped[group].length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="p-5 text-center text-xs text-muted-foreground">
                    No {group} activities.
                  </CardContent>
                </Card>
              ) : (
                grouped[group].map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onArchive={() => archiveActivity.mutate({ id: activity.id })}
                    onEdit={() => {
                      setEditingId(activity.id);
                      setForm(rowToForm(activity));
                    }}
                    onPublish={() => publishActivity.mutate({ id: activity.id })}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function useActivityRows(data: unknown) {
  return (Array.isArray(data) ? data : []) as Array<{
    category: string | null;
    description: string | null;
    durationMinutes: number | null;
    guideAddonVnd: number | null;
    guideOptional: boolean | null;
    highlights: unknown;
    id: string;
    included: unknown;
    maxCapacityPerSlot: number | null;
    photos: string[] | null;
    priceAmount: number | null;
    requirements: unknown;
    slug: string | null;
    status: string | null;
    subtitle: string | null;
    title: string | null;
  }>;
}

function ActivityFormCard({
  editing,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  editing: boolean;
  form: ActivityForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (form: ActivityForm) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-secondary">
            {editing ? "Edit activity" : "Create activity draft"}
          </h2>
          {editing && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              placeholder="Old Quarter pottery class"
            />
          </Field>
          <Field label="Subtitle">
            <Input
              value={form.subtitle}
              onChange={(e) => onChange({ ...form, subtitle: e.target.value })}
              placeholder="Hands-on clay workshop"
            />
          </Field>
          <Field label="Category">
            <Input
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Price (VND)">
            <Input
              type="number"
              value={form.priceAmount}
              onChange={(e) => onChange({ ...form, priceAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Duration (minutes)">
            <Input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => onChange({ ...form, durationMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max capacity per slot">
            <Input
              type="number"
              value={form.maxCapacityPerSlot}
              onChange={(e) => onChange({ ...form, maxCapacityPerSlot: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="What happens, who leads it, and what travelers walk away with."
          />
        </Field>

        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Photo URLs (one per line)">
            <Textarea
              rows={3}
              value={form.photosText}
              onChange={(e) => onChange({ ...form, photosText: e.target.value })}
            />
          </Field>
          <Field label="Highlights (one per line)">
            <Textarea
              rows={3}
              value={form.highlightsText}
              onChange={(e) => onChange({ ...form, highlightsText: e.target.value })}
            />
          </Field>
          <Field label="Included (one per line)">
            <Textarea
              rows={3}
              value={form.includedText}
              onChange={(e) => onChange({ ...form, includedText: e.target.value })}
            />
          </Field>
          <Field label="Requirements (one per line)">
            <Textarea
              rows={3}
              value={form.requirementsText}
              onChange={(e) => onChange({ ...form, requirementsText: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium">Guide add-on</p>
            <p className="text-xs text-muted-foreground">
              Travelers can optionally add a local guide at checkout.
            </p>
          </div>
          <Button
            size="sm"
            variant={form.guideOptional ? "default" : "outline"}
            onClick={() => onChange({ ...form, guideOptional: !form.guideOptional })}
          >
            {form.guideOptional ? "Enabled" : "Disabled"}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button disabled={isSaving} onClick={onSubmit} className="rounded-xl bg-primary">
            {editing ? "Save changes" : "Create draft"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityCard({
  activity,
  onArchive,
  onEdit,
  onPublish,
}: {
  activity: ActivityRow;
  onArchive: () => void;
  onEdit: () => void;
  onPublish: () => void;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-3">
        <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          {activity.photos?.[0] && (
            <Image
              src={activity.photos[0]}
              alt=""
              fill
              sizes="(min-width: 1024px) 30vw, 90vw"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-secondary">
            {activity.title ?? "Untitled activity"}
          </h3>
          <Badge variant="outline" className="shrink-0 text-xs capitalize">
            {activity.status ?? "draft"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {(activity.priceAmount ?? 0).toLocaleString()} VND · {activity.durationMinutes ?? 0}m
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
            Edit
          </Button>
          {(activity.status === "draft" || activity.status === "rejected") && (
            <Button size="sm" className="h-7 bg-sage text-xs text-white" onClick={onPublish}>
              Publish
            </Button>
          )}
          {activity.status === "published" && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={onArchive}>
              Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function formToPayload(form: ActivityForm) {
  return {
    category: form.category.trim() || "workshop",
    description: form.description.trim() || undefined,
    durationMinutes: form.durationMinutes,
    guideAddonVnd: form.guideAddonVnd,
    guideOptional: form.guideOptional,
    highlights: lines(form.highlightsText),
    included: lines(form.includedText),
    maxCapacityPerSlot: form.maxCapacityPerSlot,
    photos: lines(form.photosText),
    priceAmount: form.priceAmount,
    requirements: lines(form.requirementsText),
    subtitle: form.subtitle.trim() || undefined,
    title: form.title.trim(),
  };
}

function rowToForm(row: ActivityRow): ActivityForm {
  return {
    category: row.category ?? emptyForm.category,
    description: row.description ?? "",
    durationMinutes: row.durationMinutes ?? emptyForm.durationMinutes,
    guideAddonVnd: row.guideAddonVnd ?? emptyForm.guideAddonVnd,
    guideOptional: row.guideOptional ?? true,
    highlightsText: arrayToLines(row.highlights),
    includedText: arrayToLines(row.included),
    maxCapacityPerSlot: row.maxCapacityPerSlot ?? emptyForm.maxCapacityPerSlot,
    photosText: (row.photos ?? []).join("\n"),
    priceAmount: row.priceAmount ?? emptyForm.priceAmount,
    requirementsText: arrayToLines(row.requirements),
    subtitle: row.subtitle ?? "",
    title: row.title ?? "",
  };
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : "";
}
