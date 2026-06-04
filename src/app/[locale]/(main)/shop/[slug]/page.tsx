"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { trpc } from "@/lib/trpc";
import { pickLocaleField } from "@/lib/pick-locale-field";
import { formatVndPrice } from "@/lib/format";
import { merchImage } from "@/lib/merch-images";
import type { Locale } from "@/i18n/routing";

export default function ShopProductPage() {
  const params = useParams<{ slug: string }>();
  const locale = useLocale() as Locale;
  const t = useTranslations("shop");
  const tButton = useTranslations("cart.addButton");
  const utils = trpc.useUtils();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { data, isLoading } = trpc.merch.getBySlug.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug },
  );

  // No more `router.push("/cart")` on success -- the AddToCartButton owns
  // user feedback (success state + toast w/ "Xem giỏ hàng" action + fly
  // animation). All this hook does now is invalidate the cart queries
  // so the nav badge and /cart page reflect the new line.
  // Anonymous users are bounced via the authLink (see lib/trpc-auth-link)
  // on the resulting 401, so no client-side auth gate is needed here.
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      utils.cart.getCount.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        <div className="h-60 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }
  if (!data) return <div className="p-6 text-center text-sm">{t("detail.notFound")}</div>;

  const { product, variants } = data;
  const currentVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null;
  const unitPrice = currentVariant?.priceOverrideVnd ?? product.basePriceVnd;
  const totalPrice = unitPrice * quantity;
  const outOfStock = !currentVariant || currentVariant.stockQuantity <= 0;
  const productTitle = pickLocaleField<string>(product, "title", locale) ?? product.title;
  const productSubtitle = pickLocaleField<string>(product, "subtitle", locale) ?? product.subtitle;
  const productDescription = pickLocaleField<string>(product, "description", locale) ?? product.description;
  // Prefer the curated brand mockup at /brand/merch/<slug>.jpg.
  // Falls back to the DB column for any non-slugged row (future
  // host-uploaded merch under FOLLOW-10).
  const photoUrl = product.slug ? merchImage(product.slug) : product.photos?.[0];
  const productAlt = productTitle ?? product.title ?? "Locomate merch";

  const handleAdd = async () => {
    if (!currentVariant) return;
    await addToCart.mutateAsync({
      kind: "merch",
      productVariantId: currentVariant.id,
      quantity,
    });
  };

  const buttonLabel = outOfStock ? tButton("soldOut") : undefined;

  return (
    <PageTransition>
      <div className="pb-32 lg:pb-12">
        {/* Mobile: hero image at top, content stacks below. Desktop:
            2-column layout with image on the left and buying panel on
            the right, title/subtitle anchored above the split. */}
        <div className="lg:max-w-6xl lg:mx-auto lg:p-8">
          {/* Mobile hero */}
          <div className="relative h-72 bg-card lg:hidden">
            {photoUrl && (
              <Image src={photoUrl} alt={productAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            )}
            <Link href="/shop" className="absolute top-4 left-4 w-11 h-11 rounded-full bg-card/90 flex items-center justify-center">
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </Link>
            {product.bundleDiscountPct ? (
              <Badge className="absolute top-4 right-4 bg-primary border-0 text-primary-foreground text-xs">
                {t("bundleBadge", { pct: product.bundleDiscountPct })}
              </Badge>
            ) : null}
          </div>

          {/* Desktop breadcrumb */}
          <Link href="/shop" className="hidden lg:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            {t("detail.backToList")}
          </Link>

          <div className="p-4 lg:p-0 space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] lg:gap-10 lg:space-y-0">
          {/* Desktop-only photo panel */}
          <div className="hidden lg:block">
            <div className="relative aspect-square bg-card rounded-2xl overflow-hidden">
              {photoUrl && (
                <Image src={photoUrl} alt={productAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              )}
              {product.bundleDiscountPct ? (
                <Badge className="absolute top-4 right-4 bg-primary border-0 text-primary-foreground text-xs">
                  {t("bundleBadge", { pct: product.bundleDiscountPct })}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">{productTitle}</h1>
            {productSubtitle && <p className="text-sm lg:text-base text-muted-foreground mt-0.5">{productSubtitle}</p>}
            <p className="hidden lg:block text-2xl font-bold tabular-nums text-primary mt-3 whitespace-nowrap">
              {formatVndPrice(unitPrice)}
            </p>
          </div>

          {productDescription && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 lg:p-5">
                <p className="text-body text-secondary whitespace-pre-line max-w-prose">{productDescription}</p>
              </CardContent>
            </Card>
          )}

          {/* Variant picker */}
          {variants.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 lg:p-5 space-y-3">
                <h2 className="text-base lg:text-lg font-semibold text-secondary">{t("detail.variant")}</h2>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const selected = (selectedVariantId ?? variants[0]?.id) === v.id;
                    const outOfStockV = v.stockQuantity <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        disabled={outOfStockV}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          selected
                            ? "bg-secondary text-secondary-foreground border-secondary"
                            : outOfStockV
                              ? "bg-muted/40 text-muted-foreground border-border cursor-not-allowed line-through"
                              : "bg-card text-foreground border-border"
                        }`}
                      >
                        {v.label}
                        {v.priceOverrideVnd && v.priceOverrideVnd !== product.basePriceVnd ? (
                          <span className="ml-1 text-xs opacity-70 whitespace-nowrap">+{formatVndPrice(v.priceOverrideVnd - product.basePriceVnd)}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {currentVariant && (
                  <p className="text-sm text-muted-foreground">
                    {currentVariant.stockQuantity > 10
                      ? t("detail.inStock")
                      : t("detail.onlyNLeft", { n: currentVariant.stockQuantity })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quantity */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-base font-semibold text-secondary">{t("detail.quantity")}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-lg font-bold text-secondary">−</button>
                <span className="w-6 text-center text-base font-semibold tabular-nums">{quantity}</span>
                <button type="button" onClick={() => setQuantity(Math.min(currentVariant?.stockQuantity ?? 1, quantity + 1))} className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-lg font-bold text-secondary">+</button>
              </div>
            </CardContent>
          </Card>

          {/* Desktop-only inline add-to-cart (replaces the mobile sticky bar) */}
          <div className="hidden lg:flex items-center justify-between gap-4 pt-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{t("detail.total")}</p>
              <p className="text-xl font-bold tabular-nums text-secondary whitespace-nowrap">{formatVndPrice(totalPrice)}</p>
            </div>
            <AddToCartButton
              onAdd={handleAdd}
              label={buttonLabel}
              flyImage={photoUrl ?? null}
              disabled={outOfStock}
              className="rounded-xl px-8 h-12 font-bold"
            />
          </div>
          </div>
          </div>
        </div>

        {/* Mobile-only sticky add-to-cart bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("detail.total")}</p>
              <p className="text-xl font-bold text-secondary tabular-nums whitespace-nowrap">{formatVndPrice(totalPrice)}</p>
            </div>
            <AddToCartButton
              onAdd={handleAdd}
              label={buttonLabel}
              flyImage={photoUrl ?? null}
              disabled={outOfStock}
              className="rounded-xl px-6 h-12 font-bold"
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
