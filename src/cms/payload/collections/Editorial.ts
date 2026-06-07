import type { CollectionBeforeValidateHook, CollectionConfig } from "payload";

import { publishedOrAuthenticated } from "./access.ts";

type EditorialCollectionArgs = {
  group: string;
  labelPlural: string;
  labelSingular: string;
  previewPath: "blog" | "guides" | "legal";
  slug: "articles" | "guides" | "legalPages";
};

const autoSlugFromTitle: CollectionBeforeValidateHook = ({ data }) => {
  if (!data || typeof data.slug === "string" && data.slug.trim()) {
    return data;
  }

  const title = localizedText(data.title);
  if (title) {
    data.slug = title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  return data;
};

const baseEditorialFields: CollectionConfig["fields"] = [
  {
    name: "title",
    type: "text",
    label: "Title",
    localized: true,
    required: true,
    admin: {
      description: "The public page title. Fill both English and Vietnamese before publishing.",
    },
  },
  {
    name: "slug",
    type: "text",
    label: "URL slug",
    required: true,
    unique: true,
    index: true,
    admin: {
      description:
        "Stable URL segment, for example old-quarter-food-guide. Leave blank on new drafts to generate it from the title. Keep it identical across locales.",
    },
  },
  {
    name: "excerpt",
    type: "textarea",
    label: "Short summary",
    localized: true,
    admin: {
      description: "Short summary for listing cards and SEO descriptions.",
    },
  },
  {
    name: "heroImage",
    type: "upload",
    label: "Hero image",
    relationTo: "media",
    admin: {
      description: "Optional lead image shown on public listing and detail pages.",
    },
  },
  {
    name: "body",
    type: "richText",
    label: "Page body",
    localized: true,
    required: true,
    admin: {
      description: "Main article content. Use headings and short paragraphs for readability.",
    },
  },
  {
    name: "publishedAt",
    type: "date",
    label: "Published at",
    admin: {
      date: {
        pickerAppearance: "dayAndTime",
      },
      description: "Set when the page should appear as published on the public site.",
      position: "sidebar",
    },
  },
];

export function createEditorialCollection({
  group,
  labelPlural,
  labelSingular,
  previewPath,
  slug,
}: EditorialCollectionArgs): CollectionConfig {
  return {
    slug,
    access: {
      read: publishedOrAuthenticated,
    },
    admin: {
      defaultColumns: ["title", "slug", "_status", "publishedAt", "updatedAt"],
      description:
        "Draft content is visible inside the CMS. Public pages only show documents after publishing.",
      group,
      livePreview: {
        url: ({ data, locale }) => `/${locale ?? "en"}/${previewPath}/${data.slug ?? ""}`,
      },
      preview: ({ slug: documentSlug }, { locale }) =>
        documentSlug ? `/${locale ?? "en"}/${previewPath}/${documentSlug}` : null,
      useAsTitle: "title",
    },
    fields: baseEditorialFields,
    hooks: {
      beforeValidate: [autoSlugFromTitle],
    },
    labels: {
      plural: labelPlural,
      singular: labelSingular,
    },
    versions: {
      drafts: {
        autosave: false,
        localizeStatus: true,
      },
    },
  };
}

export const Articles = createEditorialCollection({
  group: "Editorial",
  labelPlural: "Articles",
  labelSingular: "Article",
  previewPath: "blog",
  slug: "articles",
});

export const Guides = createEditorialCollection({
  group: "Editorial",
  labelPlural: "Guides",
  labelSingular: "Guide",
  previewPath: "guides",
  slug: "guides",
});

export const LegalPages = createEditorialCollection({
  group: "Legal",
  labelPlural: "Legal pages",
  labelSingular: "Legal page",
  previewPath: "legal",
  slug: "legalPages",
});

function localizedText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  const localized = value as Record<string, unknown>;
  const fallback = localized.en ?? localized.vi;
  return typeof fallback === "string" ? fallback.trim() || null : null;
}
