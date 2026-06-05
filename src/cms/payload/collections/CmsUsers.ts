import type { CollectionConfig } from "payload";

export const CmsUsers: CollectionConfig = {
  slug: "cmsUsers",
  auth: true,
  admin: {
    group: "CMS",
    useAsTitle: "email",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Display name",
    },
  ],
};
