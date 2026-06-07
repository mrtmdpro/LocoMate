import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  confirmReplace,
  emptyFixedTour,
  rowToFixedTourForm,
  vector,
} from "./catalog-utils";
import { CheckboxField, Grid, NumberField, TextAreaField, TextField } from "./field";
import { ListCard } from "./list-card";
import type { FixedTourRow } from "./types";

type FixedTourChapter = "MORNING_SHIFT" | "AFTERNOON_SHIFT" | "EVENING_SHIFT";

export function FixedTourEditor({ tours }: { tours: FixedTourRow[] }) {
  const utils = trpc.useUtils();
  const [fixedTourForm, setFixedTourForm] = useState(emptyFixedTour);
  const isEditing = tours.some((tour) => tour.tourId === fixedTourForm.tourId);

  const upsertFixedTour = trpc.catalogAdmin.upsertFixedTour.useMutation({
    onSuccess: () => {
      toast.success(isEditing ? "Fixed tour updated" : "Fixed tour created");
      setFixedTourForm(emptyFixedTour);
      utils.catalogAdmin.listFixedTours.invalidate();
      utils.fixedTour.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function saveFixedTour() {
    const parsedVector = vector(fixedTourForm.vectorText);
    if (!parsedVector) {
      toast.error("Vector must be four numbers from 0 to 1, for example 0.5,0.5,0.5,0.5");
      return;
    }
    if (isEditing && !confirmReplace(fixedTourForm.titleEn || fixedTourForm.tourId)) return;

    upsertFixedTour.mutate({
      ...fixedTourForm,
      chapter: fixedTourForm.chapter as FixedTourChapter,
      vector: parsedVector,
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="font-semibold text-secondary">
              {isEditing ? "Edit fixed tour" : "New fixed tour"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Active tours can appear in public trip discovery. Save as draft while editing copy.
            </p>
          </div>
          <Grid>
            <TextField label="Tour ID" value={fixedTourForm.tourId} onChange={(tourId) => setFixedTourForm({ ...fixedTourForm, tourId })} />
            <TextField label="Chapter" value={fixedTourForm.chapter} onChange={(chapter) => setFixedTourForm({ ...fixedTourForm, chapter })} />
            <TextField label="Title EN" value={fixedTourForm.titleEn} onChange={(titleEn) => setFixedTourForm({ ...fixedTourForm, titleEn })} />
            <TextField label="Title VI" value={fixedTourForm.titleVi} onChange={(titleVi) => setFixedTourForm({ ...fixedTourForm, titleVi })} />
            <NumberField label="Price" value={fixedTourForm.basePriceVnd} onChange={(basePriceVnd) => setFixedTourForm({ ...fixedTourForm, basePriceVnd })} />
            <NumberField label="Duration" value={fixedTourForm.durationMinutes} onChange={(durationMinutes) => setFixedTourForm({ ...fixedTourForm, durationMinutes })} />
            <NumberField label="Min participants" value={fixedTourForm.minParticipants} onChange={(minParticipants) => setFixedTourForm({ ...fixedTourForm, minParticipants })} />
            <NumberField label="Max participants" value={fixedTourForm.maxParticipants} onChange={(maxParticipants) => setFixedTourForm({ ...fixedTourForm, maxParticipants })} />
          </Grid>
          <CheckboxField
            checked={fixedTourForm.isActive}
            description="Turn off while copy, pricing, or stops are still being reviewed."
            label="Active"
            onChange={(isActive) => setFixedTourForm({ ...fixedTourForm, isActive })}
          />
          <TextAreaField label="Story EN" value={fixedTourForm.storyScriptEn} onChange={(storyScriptEn) => setFixedTourForm({ ...fixedTourForm, storyScriptEn })} />
          <TextAreaField label="Story VI" value={fixedTourForm.storyScriptVi} onChange={(storyScriptVi) => setFixedTourForm({ ...fixedTourForm, storyScriptVi })} />
          <TextField
            description="Four discovery-weight numbers from 0 to 1."
            label="Vector"
            value={fixedTourForm.vectorText}
            onChange={(vectorText) => setFixedTourForm({ ...fixedTourForm, vectorText })}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={upsertFixedTour.isPending} onClick={saveFixedTour}>
              {isEditing ? "Update fixed tour" : "Create fixed tour"}
            </Button>
            {isEditing ? (
              <Button
                disabled={upsertFixedTour.isPending}
                variant="outline"
                onClick={() => setFixedTourForm(emptyFixedTour)}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ListCard
        title={`Fixed tours (${tours.length})`}
        rows={tours.map((tour) => ({
          id: tour.tourId,
          isActive: tour.isActive,
          label: tour.titleEn,
          meta: `${tour.chapter} · ${tour.basePriceVnd.toLocaleString()} VND`,
          onEdit: () => setFixedTourForm(rowToFixedTourForm(tour)),
        }))}
      />
    </section>
  );
}
