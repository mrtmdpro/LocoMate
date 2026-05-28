import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Sora } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { FlyToCartProvider } from "@/components/cart/fly-to-cart-context";
import { FlyToCartLayer } from "@/components/cart/fly-to-cart-layer";
import "./globals.css";

// Inter / Sora ship `latin-ext`, which already covers the Vietnamese
// diacritics block (Đ, ă, ơ, ư + tone marks). Cormorant Garamond ships
// an explicit `vietnamese` subset, which we use below for the brand
// italic display so accents like "Đi cho đúng" render with the
// designed glyphs rather than fallback substitutes.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin", "latin-ext"], variable: "--font-sora" });
// The brand's italic voice. Cormorant Garamond carries the Locomate wordmark
// feel (see /Bộ Nhận Diện/Moodboard.jpg) and ships with a real italic axis +
// the `vietnamese` subset, so diacritics like "Đi cho đúng" render correctly.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "LOCOMATE — Go a place, know its grace.",
  description:
    "AI-personalised travel for Hà Nội. Co-designed Fixed Tours, Flexible Tours you build yourself, and the people who actually know the city.",
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // `getLocale()` resolves through `src/i18n/request.ts`, which falls back
  // to the configured default when the request is outside the `[locale]`
  // segment (e.g. error/not-found surfaces). Stamping `<html lang>` here
  // means screen-readers and translation tooling get the right language
  // hint before the React tree hydrates.
  const locale = await getLocale();

  return (
    // suppressHydrationWarning is required by next-themes: the provider
    // injects the resolved theme class on the <html> tag client-side
    // before React hydrates, so the SSR class ("light") always
    // momentarily differs from what the user has stored locally.
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${sora.variable} ${cormorant.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>
          <FlyToCartProvider>
            {children}
            <FlyToCartLayer />
            <Toaster />
          </FlyToCartProvider>
        </Providers>
      </body>
    </html>
  );
}
