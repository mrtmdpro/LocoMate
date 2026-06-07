"use client";

import NextLink from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { AdminOnly } from "./_components/admin-only";
import { CustomizedTemplateEditor } from "./_components/customized-template-editor";
import { FixedTourEditor } from "./_components/fixed-tour-editor";
import { PlaceEditor } from "./_components/place-editor";
import type { FixedTourRow, PlaceRow, TemplateRow } from "./_components/types";

export default function AdminCatalogPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const { data: places } = trpc.catalogAdmin.listPlaces.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: fixedToursData } = trpc.catalogAdmin.listFixedTours.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: templates } = trpc.catalogAdmin.listCustomizedTemplates.useQuery(undefined, {
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <AdminOnly />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 lg:p-8">
      <div className="rounded-3xl bg-card p-5 shadow-sm">
        <Badge variant="guide">Catalog CMS</Badge>
        <h1 className="mt-3 font-heading text-xl font-bold text-secondary lg:text-2xl">
          Places, Fixed Tours, Templates
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Edit relational catalog rows that power discovery, booking, and trip planning.
          Use the content hub when you are unsure where a content type belongs.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <AdminSurfaceLink href="/admin/content" title="Content hub" body="Choose the right editor" />
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

      <Card className="border-dashed shadow-none">
        <CardContent className="space-y-1 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-secondary">Editor safety notes</p>
          <p>
            Active records may affect the public site immediately. Existing rows ask for
            confirmation before saving, and optional place fields preserve existing values
            when left blank.
          </p>
        </CardContent>
      </Card>

      <PlaceEditor places={(places ?? []) as PlaceRow[]} />
      <FixedTourEditor tours={(fixedToursData?.tours ?? []) as FixedTourRow[]} />
      <CustomizedTemplateEditor templates={(templates ?? []) as TemplateRow[]} />
    </div>
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
