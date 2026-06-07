"use client";

import NextLink from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { useAuthStore } from "@/stores/auth";

const editorialLinks = [
  {
    body: "Write and publish travel stories, updates, and SEO articles.",
    href: "/cms-admin/collections/articles",
    label: "Blog articles",
  },
  {
    body: "Maintain evergreen travel guides and destination explainers.",
    href: "/cms-admin/collections/guides",
    label: "Guides",
  },
  {
    body: "Publish terms, privacy, licenses, and other public legal pages.",
    href: "/cms-admin/collections/legalPages",
    label: "Legal pages",
  },
  {
    body: "Upload and reuse editorial images with captions and alt text.",
    href: "/cms-admin/collections/media",
    label: "Media library",
  },
];

const operationalLinks = [
  {
    body: "Edit places, fixed tours, and customized trip templates.",
    href: "/admin/catalog",
    label: "Catalog content",
  },
  {
    body: "Manage shop and merchandise content.",
    href: "/admin/products",
    label: "Products",
  },
  {
    body: "Approve, reject, and review host-submitted listings.",
    href: "/admin/experiences",
    label: "Host listings",
  },
  {
    body: "Create and update tickets, classes, workshops, and events.",
    href: "/host/activities",
    label: "Activities",
  },
];

export default function AdminContentPage() {
  const { user } = useAuthStore();

  if (user?.role !== "admin") {
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
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-24 lg:p-8">
      <section className="rounded-3xl bg-card p-5 shadow-sm lg:p-7">
        <Badge variant="guide">Editor home</Badge>
        <h1 className="mt-3 font-heading text-2xl font-bold text-secondary lg:text-3xl">
          What do you want to edit?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          LocoMate uses Payload CMS for public editorial pages and in-app tools for
          trip/catalog data with booking logic. Start here so each content type goes to
          the safest editor.
        </p>
      </section>

      <ContentSection
        description="These are draft-and-publish workflows in Payload CMS."
        external
        items={editorialLinks}
        title="Editorial content"
      />

      <ContentSection
        description="These records affect booking flows, pricing, moderation, or commerce."
        items={operationalLinks}
        title="Catalog and operations"
      />
    </main>
  );
}

function ContentSection({
  description,
  external = false,
  items,
  title,
}: {
  description: string;
  external?: boolean;
  items: Array<{ body: string; href: string; label: string }>;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold text-secondary">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <ContentCard external={external} item={item} key={item.href} />
        ))}
      </div>
    </section>
  );
}

function ContentCard({
  external,
  item,
}: {
  external: boolean;
  item: { body: string; href: string; label: string };
}) {
  const className =
    "block rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
  const children = (
    <>
      <p className="font-semibold text-secondary">{item.label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
    </>
  );

  if (external) {
    return (
      <NextLink className={className} href={item.href}>
        {children}
      </NextLink>
    );
  }

  return (
    <Link className={className} href={item.href}>
      {children}
    </Link>
  );
}
