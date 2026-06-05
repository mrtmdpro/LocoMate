import { notFound } from "next/navigation";
import { EditorialDetailPage } from "@/cms/editorial-pages";
import { isEditorialLocale } from "@/cms/editorial";

export const dynamic = "force-dynamic";

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isEditorialLocale(locale)) {
    notFound();
  }

  return <EditorialDetailPage collection="articles" locale={locale} slug={slug} />;
}
