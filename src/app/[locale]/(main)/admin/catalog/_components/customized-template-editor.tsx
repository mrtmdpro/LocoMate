import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  confirmReplace,
  emptyTemplate,
  rowToTemplateForm,
  vector,
} from "./catalog-utils";
import { CheckboxField, Grid, NumberField, TextAreaField, TextField } from "./field";
import { ListCard } from "./list-card";
import type { TemplateRow } from "./types";

export function CustomizedTemplateEditor({ templates }: { templates: TemplateRow[] }) {
  const utils = trpc.useUtils();
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const isEditing = templates.some((template) => template.templateId === templateForm.templateId);

  const upsertTemplate = trpc.catalogAdmin.upsertCustomizedTemplate.useMutation({
    onSuccess: () => {
      toast.success(isEditing ? "Template updated" : "Template created");
      setTemplateForm(emptyTemplate);
      utils.catalogAdmin.listCustomizedTemplates.invalidate();
      utils.customizedTourTemplate.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function saveTemplate() {
    const parsedVector = vector(templateForm.vectorText);
    if (!parsedVector) {
      toast.error("Vector must be four numbers from 0 to 1, for example 0.5,0.5,0.5,0.5");
      return;
    }
    if (isEditing && !confirmReplace(templateForm.titleEn || templateForm.templateId)) return;

    upsertTemplate.mutate({
      ...templateForm,
      vector: parsedVector,
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="font-semibold text-secondary">
              {isEditing ? "Edit customized template" : "New customized template"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Templates guide AI-assisted trip creation. Keep inactive until both languages are reviewed.
            </p>
          </div>
          <Grid>
            <TextField label="Template ID" value={templateForm.templateId} onChange={(templateId) => setTemplateForm({ ...templateForm, templateId })} />
            <TextField label="Theme" value={templateForm.theme} onChange={(theme) => setTemplateForm({ ...templateForm, theme })} />
            <TextField label="Title EN" value={templateForm.titleEn} onChange={(titleEn) => setTemplateForm({ ...templateForm, titleEn })} />
            <TextField label="Title VI" value={templateForm.titleVi} onChange={(titleVi) => setTemplateForm({ ...templateForm, titleVi })} />
            <NumberField label="Price" value={templateForm.basePriceVnd} onChange={(basePriceVnd) => setTemplateForm({ ...templateForm, basePriceVnd })} />
            <NumberField label="Duration" value={templateForm.durationMinutes} onChange={(durationMinutes) => setTemplateForm({ ...templateForm, durationMinutes })} />
            <NumberField label="Max participants" value={templateForm.maxParticipants} onChange={(maxParticipants) => setTemplateForm({ ...templateForm, maxParticipants })} />
          </Grid>
          <CheckboxField
            checked={templateForm.isActive}
            description="Inactive templates are drafts and should not be offered to travelers."
            label="Active"
            onChange={(isActive) => setTemplateForm({ ...templateForm, isActive })}
          />
          <TextField label="Subtitle EN" value={templateForm.subtitleEn} onChange={(subtitleEn) => setTemplateForm({ ...templateForm, subtitleEn })} />
          <TextField label="Subtitle VI" value={templateForm.subtitleVi} onChange={(subtitleVi) => setTemplateForm({ ...templateForm, subtitleVi })} />
          <TextAreaField label="Story EN" value={templateForm.storyEn} onChange={(storyEn) => setTemplateForm({ ...templateForm, storyEn })} />
          <TextAreaField label="Story VI" value={templateForm.storyVi} onChange={(storyVi) => setTemplateForm({ ...templateForm, storyVi })} />
          <TextField
            description="Four discovery-weight numbers from 0 to 1."
            label="Vector"
            value={templateForm.vectorText}
            onChange={(vectorText) => setTemplateForm({ ...templateForm, vectorText })}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={upsertTemplate.isPending} onClick={saveTemplate}>
              {isEditing ? "Update template" : "Create template"}
            </Button>
            {isEditing ? (
              <Button
                disabled={upsertTemplate.isPending}
                variant="outline"
                onClick={() => setTemplateForm(emptyTemplate)}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ListCard
        title={`Templates (${templates.length})`}
        rows={templates.map((template) => ({
          id: template.templateId,
          isActive: template.isActive,
          label: template.titleEn,
          meta: `${template.theme} · ${template.basePriceVnd.toLocaleString()} VND`,
          onEdit: () => setTemplateForm(rowToTemplateForm(template)),
        }))}
      />
    </section>
  );
}
