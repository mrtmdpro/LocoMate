import type { CollectionConfig } from "payload";

import { publishedOrAuthenticated } from "./access.ts";

type EditorialCollectionArgs = {
  group: string;
  labelPlural: string;
  labelSingular: string;
  slug: "articles" | "guides" | "legalPages";
};

const baseEditorialFields: CollectionConfig["fields"] = [
  {
    name: "title",
    type: "text",
    localized: true,
    required: true,
  },
  {
    name: "slug",
    type: "text",
    required: true,
    unique: true,
    index: true,
    admin: {
      description: "Stable URL segment. Keep this identical across locales.",
    },
  },
  {
    name: "excerpt",
    type: "textarea",
    localized: true,
    admin: {
      description: "Short summary for listing cards and SEO descriptions.",
    },
  },
  {
    name: "heroImage",
    type: "upload",
    relationTo: "media",
  },
  {
    name: "body",
    type: "richText",
    localized: true,
    required: true,
  },
  {
    name: "publishedAt",
    type: "date",
    admin: {
      date: {
        pickerAppearance: "dayAndTime",
      },
      position: "sidebar",
    },
  },
];

export function createEditorialCollection({
  group,
  labelPlural,
  labelSingular,
  slug,
}: EditorialCollectionArgs): CollectionConfig {
  return {
    slug,
    access: {
      read: publishedOrAuthenticated,
    },
    admin: {
      defaultColumns: ["title", "slug", "_status", "publishedAt", "updatedAt"],
      group,
      useAsTitle: "title",
    },
    fields: baseEditorialFields,
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
  slug: "articles",
});

export const Guides = createEditorialCollection({
  group: "Editorial",
  labelPlural: "Guides",
  labelSingular: "Guide",
  slug: "guides",
});

export const LegalPages = createEditorialCollection({
  group: "Legal",
  labelPlural: "Legal pages",
  labelSingular: "Legal page",
  slug: "legalPages",
});
