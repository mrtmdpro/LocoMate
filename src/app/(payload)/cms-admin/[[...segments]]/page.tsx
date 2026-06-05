import type { Metadata } from "next";
import config from "@payload-config";
import { generatePageMetadata, RootPage } from "@payloadcms/next/views";

import { importMap } from "../../importMap";

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  return generatePageMetadata({ config, params, searchParams });
}

export default function Page({ params, searchParams }: Args) {
  return RootPage({ config, importMap, params, searchParams });
}
