"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

type PlaceRow = {
  id: string;
  address: string | null;
  category: string;
  descriptionEn: string | null;
  descriptionVi: string | null;
  isActive: boolean | null;
  isVerified: boolean | null;
  latitude: number;
  longitude: number;
  name: string;
  nameEn: string | null;
  nameVi: string | null;
  photos: string[] | null;
  priceRange: string | null;
};

type FixedTourRow = {
  tourId: string;
  basePriceVnd: number;
  chapter: string;
  durationMinutes: number;
  isActive: boolean;
  maxParticipants: number;
  minParticipants: number;
  storyScriptEn: string;
  storyScriptVi: string;
  titleEn: string;
  titleVi: string;
  vector?: unknown;
};

type TemplateRow = {
  templateId: string;
  basePriceVnd: number;
  durationMinutes: number;
  isActive: boolean;
  maxParticipants: number;
  storyEn: string;
  storyVi: string;
  subtitleEn: string | null;
  subtitleVi: string | null;
  theme: string;
  titleEn: string;
  titleVi: string;
  vector?: unknown;
};

const emptyPlace = {
  address: "",
  category: "cafe",
  descriptionEn: "",
  descriptionVi: "",
  isActive: true,
  isVerified: true,
  latitude: 21.0285,
  longitude: 105.8542,
  name: "",
  nameEn: "",
  nameVi: "",
  photosText: "",
  priceRange: "",
};

const emptyFixedTour = {
  basePriceVnd: 900_000,
  chapter: "MORNING_SHIFT",
  durationMinutes: 180,
  maxParticipants: 8,
  minParticipants: 1,
  storyScriptEn: "",
  storyScriptVi: "",
  titleEn: "",
  titleVi: "",
  tourId: "",
  vectorText: "0.5,0.5,0.5,0.5",
};

const emptyTemplate = {
  basePriceVnd: 600_000,
  durationMinutes: 360,
  maxParticipants: 4,
  storyEn: "",
  storyVi: "",
  subtitleEn: "",
  subtitleVi: "",
  templateId: "",
  theme: "balanced",
  titleEn: "",
  titleVi: "",
  vectorText: "0.5,0.5,0.5,0.5",
};

export default function AdminCatalogPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: places } = trpc.catalogAdmin.listPlaces.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: fixedToursData } = trpc.catalogAdmin.listFixedTours.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: templates } = trpc.catalogAdmin.listCustomizedTemplates.useQuery(undefined, {
    enabled: isAdmin,
  });

  const [placeForm, setPlaceForm] = useState(emptyPlace);
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [fixedTourForm, setFixedTourForm] = useState(emptyFixedTour);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);

  const upsertPlace = trpc.catalogAdmin.upsertPlace.useMutation({
    onSuccess: () => {
      toast.success("Place saved");
      setPlaceForm(emptyPlace);
      setPlaceId(undefined);
      utils.catalogAdmin.listPlaces.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const upsertFixedTour = trpc.catalogAdmin.upsertFixedTour.useMutation({
    onSuccess: () => {
      toast.success("Fixed tour saved");
      setFixedTourForm(emptyFixedTour);
      utils.catalogAdmin.listFixedTours.invalidate();
      utils.fixedTour.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const upsertTemplate = trpc.catalogAdmin.upsertCustomizedTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      setTemplateForm(emptyTemplate);
      utils.catalogAdmin.listCustomizedTemplates.invalidate();
      utils.customizedTourTemplate.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAdmin) {
    return <AdminOnly />;
  }

  return (
    <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-5 pb-24 lg:pb-8">
      <div>
        <p className="text-eyebrow text-primary">Catalog CMS</p>
        <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">
          Places, Fixed Tours, Templates
        </h1>
        <p className="text-xs text-muted-foreground">
          Low-logic catalog rows can now be authored from Postgres instead of seed files.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <AdminSurfaceLink href="/admin/products" title="Products" body="Shop and merch content" />
        <AdminSurfaceLink href="/admin/experiences" title="Host listings" body="Moderation and review notes" />
        <AdminSurfaceLink href="/host/activities" title="Activities" body="Tickets, classes, workshops" />
        <NextLink
          href="/cms-admin"
          className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-sm font-semibold text-secondary">Editorial CMS</p>
          <p className="mt-1 text-xs text-muted-foreground">Blog, guides, legal, media</p>
        </NextLink>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-secondary">Place</h2>
            <Grid>
              <TextField label="Name" value={placeForm.name} onChange={(name) => setPlaceForm({ ...placeForm, name })} />
              <TextField label="Category" value={placeForm.category} onChange={(category) => setPlaceForm({ ...placeForm, category })} />
              <TextField label="Name EN" value={placeForm.nameEn} onChange={(nameEn) => setPlaceForm({ ...placeForm, nameEn })} />
              <TextField label="Name VI" value={placeForm.nameVi} onChange={(nameVi) => setPlaceForm({ ...placeForm, nameVi })} />
              <TextField label="Address" value={placeForm.address} onChange={(address) => setPlaceForm({ ...placeForm, address })} />
              <TextField label="Price range" value={placeForm.priceRange} onChange={(priceRange) => setPlaceForm({ ...placeForm, priceRange })} />
              <NumberField label="Latitude" value={placeForm.latitude} onChange={(latitude) => setPlaceForm({ ...placeForm, latitude })} />
              <NumberField label="Longitude" value={placeForm.longitude} onChange={(longitude) => setPlaceForm({ ...placeForm, longitude })} />
            </Grid>
            <TextAreaField label="Description EN" value={placeForm.descriptionEn} onChange={(descriptionEn) => setPlaceForm({ ...placeForm, descriptionEn })} />
            <TextAreaField label="Description VI" value={placeForm.descriptionVi} onChange={(descriptionVi) => setPlaceForm({ ...placeForm, descriptionVi })} />
            <TextAreaField label="Photo URLs" value={placeForm.photosText} onChange={(photosText) => setPlaceForm({ ...placeForm, photosText })} />
            <Button
              disabled={upsertPlace.isPending}
              onClick={() => upsertPlace.mutate({
                ...placeForm,
                id: placeId,
                address: placeForm.address || undefined,
                photos: lines(placeForm.photosText),
                priceRange: placeForm.priceRange || undefined,
              })}
            >
              Save place
            </Button>
          </CardContent>
        </Card>

        <ListCard
          title={`Places (${places?.length ?? 0})`}
          rows={(places ?? []).slice(0, 12).map((place: PlaceRow) => ({
            id: place.id,
            label: place.name,
            meta: `${place.category} · ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`,
            onEdit: () => {
              setPlaceId(place.id);
              setPlaceForm({
                ...emptyPlace,
                address: place.address ?? "",
                category: place.category,
                descriptionEn: place.descriptionEn ?? "",
                descriptionVi: place.descriptionVi ?? "",
                isActive: place.isActive ?? true,
                isVerified: place.isVerified ?? true,
                latitude: place.latitude,
                longitude: place.longitude,
                name: place.name,
                nameEn: place.nameEn ?? "",
                nameVi: place.nameVi ?? "",
                photosText: (place.photos ?? []).join("\n"),
                priceRange: place.priceRange ?? "",
              });
            },
          }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-secondary">Fixed tour</h2>
            <Grid>
              <TextField label="Tour ID" value={fixedTourForm.tourId} onChange={(tourId) => setFixedTourForm({ ...fixedTourForm, tourId })} />
              <TextField label="Chapter" value={fixedTourForm.chapter} onChange={(chapter) => setFixedTourForm({ ...fixedTourForm, chapter })} />
              <TextField label="Title EN" value={fixedTourForm.titleEn} onChange={(titleEn) => setFixedTourForm({ ...fixedTourForm, titleEn })} />
              <TextField label="Title VI" value={fixedTourForm.titleVi} onChange={(titleVi) => setFixedTourForm({ ...fixedTourForm, titleVi })} />
              <NumberField label="Price" value={fixedTourForm.basePriceVnd} onChange={(basePriceVnd) => setFixedTourForm({ ...fixedTourForm, basePriceVnd })} />
              <NumberField label="Duration" value={fixedTourForm.durationMinutes} onChange={(durationMinutes) => setFixedTourForm({ ...fixedTourForm, durationMinutes })} />
            </Grid>
            <TextAreaField label="Story EN" value={fixedTourForm.storyScriptEn} onChange={(storyScriptEn) => setFixedTourForm({ ...fixedTourForm, storyScriptEn })} />
            <TextAreaField label="Story VI" value={fixedTourForm.storyScriptVi} onChange={(storyScriptVi) => setFixedTourForm({ ...fixedTourForm, storyScriptVi })} />
            <TextField label="Vector" value={fixedTourForm.vectorText} onChange={(vectorText) => setFixedTourForm({ ...fixedTourForm, vectorText })} />
            <Button
              disabled={upsertFixedTour.isPending}
              onClick={() => upsertFixedTour.mutate({
                ...fixedTourForm,
                chapter: fixedTourForm.chapter as "MORNING_SHIFT" | "AFTERNOON_SHIFT" | "EVENING_SHIFT",
                isActive: true,
                vector: vector(fixedTourForm.vectorText),
              })}
            >
              Save fixed tour
            </Button>
          </CardContent>
        </Card>

        <ListCard
          title={`Fixed tours (${fixedToursData?.tours.length ?? 0})`}
          rows={(fixedToursData?.tours ?? []).map((tour: FixedTourRow) => ({
            id: tour.tourId,
            label: tour.titleEn,
            meta: `${tour.chapter} · ${tour.basePriceVnd.toLocaleString()} VND`,
            onEdit: () => setFixedTourForm(rowToFixedTourForm(tour)),
          }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-secondary">Customized template</h2>
            <Grid>
              <TextField label="Template ID" value={templateForm.templateId} onChange={(templateId) => setTemplateForm({ ...templateForm, templateId })} />
              <TextField label="Theme" value={templateForm.theme} onChange={(theme) => setTemplateForm({ ...templateForm, theme })} />
              <TextField label="Title EN" value={templateForm.titleEn} onChange={(titleEn) => setTemplateForm({ ...templateForm, titleEn })} />
              <TextField label="Title VI" value={templateForm.titleVi} onChange={(titleVi) => setTemplateForm({ ...templateForm, titleVi })} />
              <NumberField label="Price" value={templateForm.basePriceVnd} onChange={(basePriceVnd) => setTemplateForm({ ...templateForm, basePriceVnd })} />
              <NumberField label="Duration" value={templateForm.durationMinutes} onChange={(durationMinutes) => setTemplateForm({ ...templateForm, durationMinutes })} />
            </Grid>
            <TextAreaField label="Story EN" value={templateForm.storyEn} onChange={(storyEn) => setTemplateForm({ ...templateForm, storyEn })} />
            <TextAreaField label="Story VI" value={templateForm.storyVi} onChange={(storyVi) => setTemplateForm({ ...templateForm, storyVi })} />
            <TextField label="Vector" value={templateForm.vectorText} onChange={(vectorText) => setTemplateForm({ ...templateForm, vectorText })} />
            <Button
              disabled={upsertTemplate.isPending}
              onClick={() => upsertTemplate.mutate({
                ...templateForm,
                isActive: true,
                vector: vector(templateForm.vectorText),
              })}
            >
              Save template
            </Button>
          </CardContent>
        </Card>

        <ListCard
          title={`Templates (${templates?.length ?? 0})`}
          rows={(templates ?? []).map((template: TemplateRow) => ({
            id: template.templateId,
            label: template.titleEn,
            meta: `${template.theme} · ${template.basePriceVnd.toLocaleString()} VND`,
            onEdit: () => setTemplateForm(rowToTemplateForm(template)),
          }))}
        />
      </section>
    </div>
  );
}

function AdminOnly() {
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 lg:grid-cols-2">{children}</div>;
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ListCard({
  rows,
  title,
}: {
  rows: Array<{ id: string; label: string; meta: string; onEdit: () => void }>;
  title: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <h2 className="font-semibold text-secondary">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
              </div>
              <Button size="sm" variant="outline" onClick={row.onEdit}>
                Edit
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AdminSurfaceLink({
  body,
  href,
  title,
}: {
  body: string;
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-sm font-semibold text-secondary">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </Link>
  );
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function vector(value: string): [number, number, number, number] {
  const parsed = value.split(",").map((part) => Number(part.trim()));
  if (parsed.length !== 4 || parsed.some((n) => Number.isNaN(n))) {
    return [0.5, 0.5, 0.5, 0.5];
  }
  return parsed as [number, number, number, number];
}

function rowToFixedTourForm(row: FixedTourRow) {
  return {
    basePriceVnd: row.basePriceVnd,
    chapter: row.chapter,
    durationMinutes: row.durationMinutes,
    maxParticipants: row.maxParticipants,
    minParticipants: row.minParticipants,
    storyScriptEn: row.storyScriptEn,
    storyScriptVi: row.storyScriptVi,
    titleEn: row.titleEn,
    titleVi: row.titleVi,
    tourId: row.tourId,
    vectorText: Array.isArray(row.vector) ? row.vector.join(",") : emptyFixedTour.vectorText,
  };
}

function rowToTemplateForm(row: TemplateRow) {
  return {
    basePriceVnd: row.basePriceVnd,
    durationMinutes: row.durationMinutes,
    maxParticipants: row.maxParticipants,
    storyEn: row.storyEn,
    storyVi: row.storyVi,
    subtitleEn: row.subtitleEn ?? "",
    subtitleVi: row.subtitleVi ?? "",
    templateId: row.templateId,
    theme: row.theme,
    titleEn: row.titleEn,
    titleVi: row.titleVi,
    vectorText: Array.isArray(row.vector) ? row.vector.join(",") : emptyTemplate.vectorText,
  };
}
