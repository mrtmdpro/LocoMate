import type { CollectionConfig } from "payload";

import { publishedOrAuthenticated } from "./access.ts";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: publishedOrAuthenticated,
  },
  admin: {
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
      localized: true,
      required: true,
    },
    {
      name: "caption",
      type: "textarea",
      localized: true,
    },
  ],
};
