import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  confirmReplace,
  emptyPlace,
  lines,
} from "./catalog-utils";
import { CheckboxField, Grid, NumberField, TextAreaField, TextField } from "./field";
import { ListCard } from "./list-card";
import type { PlaceRow } from "./types";

export function PlaceEditor({ places }: { places: PlaceRow[] }) {
  const utils = trpc.useUtils();
  const [placeForm, setPlaceForm] = useState(emptyPlace);
  const [placeId, setPlaceId] = useState<string | undefined>();

  const upsertPlace = trpc.catalogAdmin.upsertPlace.useMutation({
    onSuccess: () => {
      toast.success(placeId ? "Place updated" : "Place created");
      setPlaceForm(emptyPlace);
      setPlaceId(undefined);
      utils.catalogAdmin.listPlaces.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function savePlace() {
    const photos = lines(placeForm.photosText);
    if (!placeForm.name.trim()) {
      toast.error("Place name is required");
      return;
    }
    if (photos.some((photo) => !isPublicUrl(photo))) {
      toast.error("Photo URLs must start with http:// or https://");
      return;
    }
    if (placeId && !confirmReplace(placeForm.name)) return;

    upsertPlace.mutate({
      ...placeForm,
      id: placeId,
      address: placeForm.address || undefined,
      photos,
      priceRange: placeForm.priceRange || undefined,
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="font-semibold text-secondary">
              {placeId ? "Edit place" : "New place"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Blank optional fields preserve existing data when editing a seeded place.
            </p>
          </div>
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
          <Grid>
            <CheckboxField
              checked={placeForm.isActive}
              description="Inactive places stay hidden from public discovery surfaces."
              label="Active"
              onChange={(isActive) => setPlaceForm({ ...placeForm, isActive })}
            />
            <CheckboxField
              checked={placeForm.isVerified}
              description="Verified places are considered editor-approved catalog records."
              label="Verified"
              onChange={(isVerified) => setPlaceForm({ ...placeForm, isVerified })}
            />
          </Grid>
          <TextAreaField label="Description EN" value={placeForm.descriptionEn} onChange={(descriptionEn) => setPlaceForm({ ...placeForm, descriptionEn })} />
          <TextAreaField label="Description VI" value={placeForm.descriptionVi} onChange={(descriptionVi) => setPlaceForm({ ...placeForm, descriptionVi })} />
          <TextAreaField
            description="One public image URL per line. Upload editorial images in Payload first when possible."
            label="Photo URLs"
            value={placeForm.photosText}
            onChange={(photosText) => setPlaceForm({ ...placeForm, photosText })}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={upsertPlace.isPending} onClick={savePlace}>
              {placeId ? "Update place" : "Create place"}
            </Button>
            {placeId ? (
              <Button
                disabled={upsertPlace.isPending}
                variant="outline"
                onClick={() => {
                  setPlaceForm(emptyPlace);
                  setPlaceId(undefined);
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ListCard
        title={`Places (${places.length})`}
        rows={places.slice(0, 12).map((place) => ({
          id: place.id,
          isActive: place.isActive,
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
  );
}

function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
