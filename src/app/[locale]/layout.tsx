import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * Locale segment layout. Validates the URL `params.locale` against the
 * configured locales, hands it to next-intl's request machinery, and wraps
 * children in the client provider so `useTranslations` works in client
 * components rendered below this point.
 *
 * `<html>` and `<body>` live in the outer `app/layout.tsx`; this layout
 * only adds the locale annotation via the provider's `locale` prop.
 *
 * `generateStaticParams` declares every supported locale so the build can
 * pre-render static pages per-locale rather than falling back to dynamic
 * rendering.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider locale={locale}>{children}</NextIntlClientProvider>
  );
}
