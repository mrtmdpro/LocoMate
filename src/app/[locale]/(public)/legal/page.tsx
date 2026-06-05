import { notFound } from "next/navigation";
import { EditorialListPage } from "@/cms/editorial-pages";
import { isEditorialLocale } from "@/cms/editorial";

export const dynamic = "force-dynamic";

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isEditorialLocale(locale)) {
    notFound();
  }

  return <EditorialListPage collection="legalPages" locale={locale} />;
}
