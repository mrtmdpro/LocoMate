import type { CollectionConfig } from "payload";

import { publishedOrAuthenticated } from "./access.ts";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: publishedOrAuthenticated,
  },
  admin: {
    defaultColumns: ["alt", "caption", "mimeType", "updatedAt"],
    description:
      "Editorial image library. Add descriptive alt text so public pages stay accessible.",
    group: "Editorial",
    useAsTitle: "alt",
  },
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Alt text",
      localized: true,
      required: true,
      admin: {
        description:
          "Describe the image for screen readers, for example: Street food vendor in Hanoi Old Quarter.",
      },
    },
    {
      name: "caption",
      type: "textarea",
      label: "Caption",
      localized: true,
      admin: {
        description: "Optional visible caption or image credit.",
      },
    },
  ],
};
