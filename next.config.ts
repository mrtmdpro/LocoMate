import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Serve modern formats; next/image negotiates per Accept header.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "randomuser.me" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // User-uploaded content (avatars, chat images) via @vercel/blob.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
